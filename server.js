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

const cloudinary = require('cloudinary').v2;
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
    origin: ['https://wow-community.com', 'http://localhost:4200'],
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type']
  }
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
      'https://wow-community.com', 'http://localhost:4200',
      /\.vercel\.app$/,
    ];
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(allowed =>
      allowed instanceof RegExp ? allowed.test(origin) : origin === allowed
    );
    callback(null, isAllowed);
  },
  credentials: true,
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'Accept',
    'X-Requested-With'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
};


app.use(cors(corsOptions));

// Middleware anti-caché para todas las respuestas
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Parser y cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
// Servir sitemap.xml y robots.txt desde la raíz del dominio
app.use(express.static(path.join(__dirname, 'public')));


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
const vipRoutes = require('./src/routes/vipRoutes');
const referralRoutes = require('./src/routes/referralRoutes');
const gameRoutes = require('./src/routes/gameRoutes');
const cookieRoutes = require('./src/routes/cookieRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const achievementRoutes = require('./src/routes/achievementRoutes');
const leaderboardRoutes = require('./src/routes/leaderboardRoutes');
const shopRoutes = require('./src/routes/shopRoutes');
const badgeRoutes = require('./src/routes/badgeRoutes');
const missionRoutes = require('./src/routes/missionRoutes');

// 🍪 Sistema de gestión de cookies
const { 
  cookieMiddleware, 
  cookieMessageMiddleware, 
  secureSessionMiddleware 
} = require('./src/middlewares/cookieMiddleware');

// Aplicar middleware de cookies a todas las rutas
app.use(cookieMiddleware);
app.use(cookieMessageMiddleware);

app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/replies', replyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vip', vipRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/cookies', cookieRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api', healthRoutes);

// Endpoint temporal para ejecutar seed de juegos (ELIMINAR DESPUÉS DE USAR)
app.post('/api/admin/seed-games', async (req, res) => {
  try {
    const seedGames = require('./src/seeds/gamesSeed');
    await seedGames();
    res.json({ success: true, message: 'Juegos y categorías creados exitosamente' });
  } catch (error) {
    console.error('Error en seed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint temporal para ejecutar seed de badges (ELIMINAR DESPUÉS DE USAR)
app.post('/api/admin/seed-badges', async (req, res) => {
  try {
    const seedBadges = require('./src/seeds/badgesSeed');
    const badges = await seedBadges();
    res.json({ 
      success: true, 
      message: `${badges.length} badges creados exitosamente`,
      count: badges.length
    });
  } catch (error) {
    console.error('Error en seed de badges:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint temporal para migrar roles (ELIMINAR DESPUÉS DE USAR)
app.post('/api/admin/migrate-roles', async (req, res) => {
  try {
    console.log(' Iniciando migración de roles...');
    
    const roleMapping = {
      'user': 'Player',
      'moderator': 'GameMaster',
      'admin': 'Admin'
    };

    let totalMigrated = 0;
    const results = {};

    for (const [oldRole, newRole] of Object.entries(roleMapping)) {
      const count = await User.countDocuments({ role: oldRole });
      
      if (count > 0) {
        console.log(` Migrando ${count} usuarios de '${oldRole}' a '${newRole}'...`);
        const result = await User.updateMany(
          { role: oldRole },
          { $set: { role: newRole } }
        );
        results[oldRole] = { count, migrated: result.modifiedCount };
        totalMigrated += result.modifiedCount;
      } else {
        results[oldRole] = { count: 0, migrated: 0 };
      }
    }

    // Corregir roles inválidos
    const invalidCount = await User.countDocuments({
      role: { $nin: ['Player', 'GameMaster', 'Admin'] }
    });

    if (invalidCount > 0) {
      const fixResult = await User.updateMany(
        { role: { $nin: ['Player', 'GameMaster', 'Admin'] } },
        { $set: { role: 'Player' } }
      );
      results.invalid = { count: invalidCount, fixed: fixResult.modifiedCount };
      totalMigrated += fixResult.modifiedCount;
    }

    // Resumen final
    const playerCount = await User.countDocuments({ role: 'Player' });
    const gmCount = await User.countDocuments({ role: 'GameMaster' });
    const adminCount = await User.countDocuments({ role: 'Admin' });

    console.log(' Migración completada');
    res.json({ 
      success: true, 
      message: 'Migración de roles completada',
      totalMigrated,
      results,
      summary: {
        Player: playerCount,
        GameMaster: gmCount,
        Admin: adminCount,
        total: playerCount + gmCount + adminCount
      }
    });
  } catch (error) {
    console.error('Error en migración:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Rate limiting
const ratePoints = isProduction ? 50 : 100;
const rateLimiter = new RateLimiterMemory({ points: ratePoints, duration: 60 });
app.use((req, res, next) => {
  if (req.path.includes('/replies') || req.path.includes('/posts')) return next();
  rateLimiter.consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ message: 'Too Many Requests' }));
});

// 💬 Sistema de Chat en Tiempo Real con Socket.IO
const socketHandler = require('./src/sockets/socketHandler');
socketHandler.initialize(io);

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
    // Guard: require MONGO_URI to be set for startup
    if (!process.env.MONGO_URI) {
      console.error('❌ FATAL: MONGO_URI no definido. Por favor configura MONGO_URI en tu .env o en las variables de entorno.');
      process.exit(1);
    }

    // Conectar a MongoDB
    await connectDB();
    console.log('✅ MongoDB connected');

    // Limpiar profileImages después de conectar a DB
    const { cleanProfileImages } = require('./src/controllers/userController');
    await cleanProfileImages();

    // Ejecutar seed de datos iniciales
    await seed();

    // Ejecutar seed de logros (solo si no existen)
    const seedAchievements = require('./src/scripts/seedAchievements');
    await seedAchievements();

    // Ejecutar seed de achievements por rachas
    const seedStreakAchievements = require('./src/scripts/seedStreakAchievements');
    await seedStreakAchievements();

    // Ejecutar seed de badges de eventos
    const seedEventBadges = require('./src/scripts/seedEventBadges');
    await seedEventBadges();

    // Iniciar cron job de expiración VIP
    const { startVipExpirationNotifier } = require('./src/jobs/vipExpirationNotifier');
    startVipExpirationNotifier();

    // Iniciar cron job de validación de referidos
    const { startReferralValidator } = require('./src/jobs/referralValidator');
    startReferralValidator();

    // Iniciar cron job de misiones diarias
    const { startDailyMissionReset } = require('./src/jobs/dailyMissionReset');
    startDailyMissionReset();

    // Generar misiones del día si no existen
    const { generateDailyMissions } = require('./src/controllers/missionController');
    await generateDailyMissions();

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