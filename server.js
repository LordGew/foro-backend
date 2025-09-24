// server.js (adaptado para Vercel serverless)
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
const fs = require('fs');
const crypto = require('crypto');

dotenv.config();
console.log('Loaded environment variables:', Object.keys(process.env).filter(k => k.startsWith('STRIPE_') || k.includes('SECRET')).map(k => `${k}: ${process.env[k] ? '***' : 'undefined'}`));

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY is not defined in .env');
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Modelos
const User = require('./src/models/User');
const Banner = require('./src/models/Banner');

// Middlewares
const authMiddleware = require('./src/middlewares/authMiddleware');

// Inicializar Express
const app = express();

// Crear directorios de subida si no existen
const uploadDirs = [
  'public/uploads',
  'public/uploads/profiles',
  'public/uploads/posts',
  'public/uploads/banners',
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// MIDDLEWARES DE SEGURIDAD Y CORS
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: isProduction ? 'no-referrer' : 'origin',
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
  methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,X-CSRF-Token,X-XSRF-TOKEN,x-user-id',
}));

// SERVIR ARCHIVOS ESTÁTICOS
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// PARSER DE BODY Y COOKIES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('cookie-parser')());

// SESSION
const isSecure = isProduction;
app.use(session({
  secret: process.env.SESSION_SECRET || 'tu_clave_secreta_muy_segura',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isSecure,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// MULTER
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) return cb(null, true);
  cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
};

const createMulterStorage = (destDir) => multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  },
});

const uploadProfile = multer({ storage: createMulterStorage('public/uploads/profiles/'), limits: { fileSize: 5*1024*1024 }, fileFilter });
const uploadPost = multer({ storage: createMulterStorage('public/uploads/posts/'), limits: { fileSize: 5*1024*1024 }, fileFilter });
const uploadBanner = multer({ storage: createMulterStorage('public/uploads/banners/'), limits: { fileSize: 5*1024*1024 }, fileFilter });

// Rutas (ejemplo, tus rutas completas)
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

// RATE LIMITER
const rateLimiter = new RateLimiterMemory({ points: isProduction ? 50 : 100, duration: 60 });
app.use((req,res,next)=>{
  if(req.path.includes('/replies')||req.path.includes('/posts')) return next();
  rateLimiter.consume(req.ip).then(()=>next()).catch(()=>res.status(429).json({message:'Too Many Requests'}));
});

// MONGODB
const connectDB = require('./src/config/db');
connectDB().catch(err => console.error('Error connecting to MongoDB:', err));

// SWAGGER (solo dev)
if (!isProduction) {
  const swaggerDocs = yaml.load(path.join(__dirname, 'swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
}

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err instanceof multer.MulterError) return res.status(400).json({ message: `Upload error: ${err.message}` });
  if (err.message && err.message.includes('Solo se permiten imágenes')) return res.status(400).json({ message: err.message });
  res.status(500).json({ message:'Internal Server Error', error: err.message, stack: !isProduction?err.stack:undefined });
});

// EXPORT PARA VERCEL
module.exports = app;
