// 5. En prod: Cambia secure: true y sameSite: 'strict'/'none' según HTTPS.

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const session = require('express-session');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const swaggerUi = require('swagger-ui-express');
const yaml = require('yamljs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const crypto = require('crypto');

// Cargar variables de entorno y depuración
dotenv.config();
console.log('Loaded environment variables:', Object.keys(process.env).filter(k => k.startsWith('STRIPE_') || k.includes('SECRET')).map(k => `${k}: ${process.env[k] ? '***' : 'undefined'}`)); // Log parcial para seguridad
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY is not defined in .env');
  process.exit(1);
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Importar modelos
const User = require('./src/models/User');
const Banner = require('./src/models/Banner');

// Importar middlewares y rutas
const authMiddleware = require('./src/middlewares/authMiddleware');

// Inicializar aplicación y servidor
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:4200', credentials: true },
});

// Crear directorios de subida si no existen
const uploadDirs = [
  'public/uploads',
  'public/uploads/profiles',
  'public/uploads/posts',
  'public/uploads/banners',
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Directorio creado: ${dir}`);
  }
});

// 1. MIDDLEWARES DE SEGURIDAD Y CORS (PRIMERO)
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: isProduction ? 'no-referrer' : 'origin',  // Más estricto en prod
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
  methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,X-CSRF-Token,X-XSRF-TOKEN,x-user-id',
}));
// 5. SERVIR ARCHIVOS ESTÁTICOS
app.use('/uploads', (req, res, next) => {
  console.log('Solicitud de archivo estático:', req.originalUrl);
  next();
}, express.static(path.join(__dirname, 'public/uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// 2. PARSER DE BODY Y COOKIES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('cookie-parser')());

// 3. SESSION (ANTES DE CSRF, PARA INICIALIZAR req.session)
const isSecure = isProduction;  // true solo en prod (HTTPS)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tu_clave_secreta_muy_segura',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isSecure,  // true en prod
      sameSite: isProduction ? 'none' : 'lax',  // PERMANENTE: 'none' en prod (HTTPS), 'lax' en dev
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// 4. CONFIGURACIÓN DE MULTER PARA SUBIDAS
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/profiles/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const postStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/posts/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const bannersDir = 'public/uploads/banners';
    console.log('Destino de multer para banners:', bannersDir);
    if (!fs.existsSync(bannersDir)) {
      fs.mkdirSync(bannersDir, { recursive: true });
      console.log(`Directorio creado: ${bannersDir}`);
    }
    cb(null, bannersDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}${ext}`;
    console.log('Nombre de archivo generado:', filename);
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) return cb(null, true);
  cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
};

const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

const uploadPost = multer({
  storage: postStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

const uploadBanner = multer({
  storage: bannerStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});


// 7. RUTAS DE AUTENTICACIÓN Y UTILIDADES (SIN CSRF)

// Endpoint para crear PaymentIntent y redirigir a Stripe Checkout
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
    console.error('Error creating Stripe Checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para procesar el éxito del pago
app.post('/api/users/success', authMiddleware, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id parameter' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      const userId = req.user.userId;
      const user = await User.findById(userId);
      if (user) {
        let expiresAt;
        switch (session.metadata.duration) {
          case 'bimonthly':
            expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
            break;
          case 'lifetime':
            expiresAt = null;
            break;
          default:
            expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        }
        user.vip = true;
        user.vipExpiresAt = expiresAt;
        await user.save();
        return res.json({ status: 'paid', expiresAt });
      } else {
        return res.status(404).json({ error: 'User not found' });
      }
    } else {
      return res.status(400).json({ error: 'Payment not successful' });
    }
  } catch (error) {
    console.error('Error processing payment success:', error);
    res.status(500).json({ error: 'Error processing payment success' });
  }
});

// PUT /api/messages/:chatId/:messageId -> editar mensaje
app.put('/api/messages/:chatId/:messageId', async (req, res) => {
  const { chatId, messageId } = req.params;
  if (!chatId || !messageId) {
    return res.status(400).json({ error: 'Invalid chatId or messageId parameter' });
  }

  const { content } = req.body || {};
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  if (!global.messages) global.messages = {};
  if (!global.messages[chatId]) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const idx = global.messages[chatId].findIndex((m) => m.id === messageId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Message not found' });
  }

  global.messages[chatId][idx].content = content;
  global.messages[chatId][idx].editedAt = new Date().toISOString();

  const updated = global.messages[chatId][idx];
  io.emit('messageEdited', {
    chatId,
    messageId,
    content: updated.content,
    editedAt: updated.editedAt,
  });

  return res.json(updated);
});

// 12. RUTAS PRINCIPALES
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

// Elimina el PUT suelto para messages (ahora en messageRoutes)

// 9. RATE LIMITING (MOVIDO DESPUÉS DE RUTAS)
const ratePoints = isProduction ? 50 : 100;
const rateLimiter = new RateLimiterMemory({ points: ratePoints, duration: 60 });
app.use((req, res, next) => {
  if (req.path.includes('/replies') || req.path.includes('/posts')) return next();  // Skip para replies/posts
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ message: 'Too Many Requests' }));
});

// 10. CONEXIÓN A MONGODB
const connectDB = require('./src/config/db');
connectDB();

// 11. SOCKET.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
  });

  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
  });

  socket.on('message', ({ chatId, msg }) => {
    io.to(chatId).emit('message', { msg });
  });

  socket.on('messagesRead', ({ chatId, userId }) => {
    io.to(chatId).emit('messagesRead', { chatId, userId });
  });

  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// 13. SWAGGER API DOCS (deshabilitado en prod por seguridad)
if (!isProduction) {
  const swaggerDocs = yaml.load(path.join(__dirname, 'swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
}

// 14. MIDDLEWARE DE MANEJO DE ERRORES (AL FINAL)
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }

  if (err.message && err.message.includes('Solo se permiten imágenes')) {
    return res.status(400).json({ message: err.message });
  }

  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message,
    stack: !isProduction ? err.stack : undefined,  // Stack solo en dev
  });
});

// 15. INICIAR SERVIDOR
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
    console.log(`Serviendo archivos estáticos desde: ${path.join(__dirname, 'public/uploads')}`);
    console.log(`Banners servidos desde: ${path.join(__dirname, 'public/uploads/banners')}`);
  });
}

module.exports = { app, io, uploadProfile, uploadPost, uploadBanner };