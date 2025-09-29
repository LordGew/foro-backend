const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const swaggerUi = require('swagger-ui-express');
const yaml = require('yamljs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const connectDB = require('./src/config/db');
const seed = require('./seed');

// Cargar variables de entorno
dotenv.config();

// Verificar Stripe en producción
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.STRIPE_SECRET_KEY) {
  console.error('❌ FATAL: STRIPE_SECRET_KEY no definido en producción');
  process.exit(1);
}

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('✅ Stripe inicializado');
} else {
  console.warn('⚠️ STRIPE_SECRET_KEY no definido (modo desarrollo)');
}

// Importar modelos y middlewares
const User = require('./src/models/User');
const authMiddleware = require('./src/middlewares/authMiddleware');

// Inicializar app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  },
});

// Crear directorios de subida (en desarrollo y producción)
const uploadDirs = [
  'public/uploads',
  'public/uploads/profiles',
  'public/uploads/posts',
  'public/uploads/banners',
];
uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Directorio creado: ${dir}`);
  }
});

// Middlewares de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: isProduction ? 'no-referrer' : 'origin',
}));

// CORS configurado correctamente
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://wow-community.com',
      'http://localhost:4200',
      /\.vercel\.app$/,
    ];

    // Permite peticiones sin origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed =>
      allowed instanceof RegExp ? allowed.test(origin) : origin === allowed
    );

    callback(null, isAllowed);
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Parser y cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Sesiones
const isSecure = isProduction;
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isSecure,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Archivos estáticos (en desarrollo y producción)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Rutas de Stripe
if (stripe) {
  app.post('/api/users/create-payment-intent', authMiddleware, async (req, res) => {
    const { amount, currency, duration, success_url, cancel_url } = req.body;
    try {
      if (!amount || !currency || !duration || !success_url || !cancel_url) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency,
            product_data: {
              name: `VIP Membership - ${duration === 'bimonthly' ? '60 días' : duration === 'year' ? '1 año' : 'Vitalicio'}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url,
        cancel_url,
        metadata: { duration },
      });
      res.json({ sessionId: session.id });
    } catch (error) {
      console.error('Stripe error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users/success', authMiddleware, async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing session_id' });
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid') {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        let expiresAt;
        switch (session.metadata.duration) {
          case 'bimonthly': expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); break;
          case 'year': expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); break;
          case 'lifetime': expiresAt = null; break;
          default: expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        }
        user.vip = true;
        user.vipExpiresAt = expiresAt;
        await user.save();
        return res.json({ status: 'paid', expiresAt });
      }
      res.status(400).json({ error: 'Payment not successful' });
    } catch (error) {
      console.error('Payment success error:', error);
      res.status(500).json({ error: 'Error processing payment' });
    }
  });
}

// Webhook de Stripe
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(400).send('Webhook secret missing');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    console.log('✅ Pago completado vía webhook:', event.data.object.id);
  }

  res.status(200).end();
});

// Ruta de mensajes (MVP con memoria)
app.put('/api/messages/:chatId/:messageId', async (req, res) => {
  const { chatId, messageId } = req.params;
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Content is required' });

  if (!global.messages) global.messages = {};
  if (!global.messages[chatId]) return res.status(404).json({ error: 'Chat not found' });

  const idx = global.messages[chatId].findIndex((m) => m.id === messageId);
  if (idx === -1) return res.status(404).json({ error: 'Message not found' });

  global.messages[chatId][idx].content = content;
  global.messages[chatId][idx].editedAt = new Date().toISOString();

  const updated = global.messages[chatId][idx];
  io.emit('messageEdited', { chatId, messageId, content: updated.content, editedAt: updated.editedAt });
  res.json(updated);
});

// Rutas principales
const userRoutes = require('./src/routes/userRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const postRoutes = require('./src/routes/postRoutes');
const replyRoutes = require('./src/routes/replyRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const bannerRoutes = require('./src/routes/bannerRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/replies', replyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// Rate limiting
const ratePoints = isProduction ? 50 : 100;
const rateLimiter = new RateLimiterMemory({ points: ratePoints, duration: 60 });
app.use((req, res, next) => {
  if (req.path.includes('/replies') || req.path.includes('/posts')) return next();
  rateLimiter.consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ message: 'Too Many Requests' }));
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  socket.on('join', (userId) => socket.join(userId));
  socket.on('joinChat', (chatId) => socket.join(chatId));
  socket.on('message', ({ chatId, msg }) => io.to(chatId).emit('message', { msg }));
  socket.on('messagesRead', ({ chatId, userId }) => io.to(chatId).emit('messagesRead', { chatId, userId }));
  socket.on('disconnect', () => console.log('🔌 User disconnected:', socket.id));
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Swagger (en desarrollo y producción)
try {
  const swaggerDocs = yaml.load(path.join(__dirname, 'swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
} catch (e) {
  console.warn('⚠️ Swagger no disponible:', e.message);
}

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message?.includes('Solo se permiten imágenes') || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: err.message || 'Upload error' });
  }
  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message,
    stack: !isProduction ? err.stack : undefined,
  });
});

// Iniciar servidor con seed
const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    console.log('✅ MongoDB connected');

    // Ejecutar seed
    await seed();

    // Iniciar servidor
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT} [${isProduction ? 'PROD' : 'DEV'}]`);
      console.log(`🌍 FRONTEND_URL: ${process.env.FRONTEND_URL}`);
    });
  } catch (err) {
    console.error('❌ Error al iniciar el servidor:', err);
    process.exit(1);
  }
};

// Solo inicia si no es un test
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, io };