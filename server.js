const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const csurf = require('csurf');
const multer = require('multer');
const session = require('express-session');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const swaggerUi = require('swagger-ui-express');
const yaml = require('yamljs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

dotenv.config();

// Crear directorios necesarios si no existen
const uploadDir = 'public/uploads/profiles';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:4200', credentials: true },
});

// Middleware de seguridad - Configura helmet para evitar bloqueo CORP
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }  // O false para desactivar
}));

// Servir archivos estáticos (para /uploads/profiles/...)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Configuración de CORS
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:4200', 
  credentials: true, 
  methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,X-CSRF-Token,X-XSRF-TOKEN'
}));

// Middleware para parsear JSON y URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para cookies
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Middleware de sesiones
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tu_clave_secreta_muy_segura',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/posts/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
  }
});

// Ruta para obtener el token CSRF - SIN csrfProtection aquí
app.get('/api/csrf-token', (req, res) => {
  // Generar token CSRF manualmente
  const csrfToken = require('csurf')({ cookie: true })(req, res, () => {
    return req.csrfToken ? req.csrfToken() : Math.random().toString(36).substr(2, 10);
  });
  
  res.json({ 
    csrfToken: csrfToken || Math.random().toString(36).substr(2, 10) 
  });
});

// Aplicar CSRF a rutas protegidas
app.use('/api/posts', (req, res, next) => {
  const csrfToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
  // Para desarrollo, permitimos cualquier token válido
  if (req.method !== 'GET' && !csrfToken) {
    return res.status(403).json({ 
      message: 'Token CSRF requerido',
      error: 'csrf_token_required'
    });
  }
  next();
});

// Rate limiting
const rateLimiter = new RateLimiterMemory({ points: 100, duration: 60 });
app.use((req, res, next) => {
  rateLimiter.consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ message: 'Too Many Requests' }));
});

// Conexión a MongoDB
const connectDB = require('./src/config/db');
connectDB();

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join', (userId) => socket.join(userId));
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Rutas
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


// Swagger API Docs
const swaggerDocs = yaml.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Manejar errores de Multer (subida de archivos)
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  
  // Manejar errores de validación de archivos
  if (err.message && err.message.includes('Solo se permiten imágenes')) {
    return res.status(400).json({ message: err.message });
  }
  
  res.status(500).json({ 
    message: 'Internal Server Error', 
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;