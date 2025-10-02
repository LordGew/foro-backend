const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  logout, 
  updateProfile, 
  changeRole, 
  banUser, 
  unbanUser,
  muteUser,
  unmuteUser,
  getUserProfile, 
  updatePassword,
  updateProfileImage,
  getUserById,
  searchUsers,
  getOnlineUsers,
  getUsersCount,
  deactivateVip,
  activateVip,
  checkVipStatus,
  processVipPayment,
  createPaymentIntent,
  handleStripeWebhook,
  unblockUser
} = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const multer = require('multer');
const path = require('path');


// Configuración de Multer
// --- NUEVO: Configuración de Multer para subida a Cloudinary ---
const uploadProfileImageToCloudinary = multer({
  storage: multer.memoryStorage(), // Almacenar en memoria en lugar de disco
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
  }
});
// --- FIN NUEVO ---

// Registro y login (públicos - sin CSRF)
router.post('/register', register);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);

// Búsqueda y consultas (sin CSRF, lectura)
router.get('/count', getUsersCount);
router.get('/online', authMiddleware, getOnlineUsers);
router.get('/search', searchUsers);

// Perfil y seguridad (con auth - REMOVIDO: csrfProtection)
router.get('/profile', authMiddleware, getUserProfile);
router.patch('/update-password', authMiddleware, updatePassword);  // REMOVIDO: csrfProtection
router.put('/profile', authMiddleware, updateProfile);  // REMOVIDO: csrfProtection


// Admin: gestión de usuarios (con RBAC - REMOVIDO: csrfProtection)
router.put('/user/:id/role', authMiddleware, rbacMiddleware('Admin'), changeRole);  // REMOVIDO: csrfProtection
router.put('/user/:id/ban', authMiddleware, rbacMiddleware('Admin'), banUser);  // REMOVIDO: csrfProtection
router.put('/user/:id/unban', authMiddleware, rbacMiddleware('Admin'), unbanUser);  // REMOVIDO: csrfProtection
router.put('/user/:id/mute', authMiddleware, rbacMiddleware('Admin'), muteUser);  // REMOVIDO: csrfProtection
router.put('/user/:id/unmute', authMiddleware, rbacMiddleware('Admin'), unmuteUser);  // REMOVIDO: csrfProtection
router.put('/user/:id/unblock', authMiddleware, unblockUser);  // REMOVIDO: csrfProtection

// Ruta de usuario por ID (al final, lectura)
router.get('/:id', authMiddleware, getUserById);

// Rutas VIP (con auth - REMOVIDO: csrfProtection)
router.post('/activate-vip', authMiddleware, activateVip);  // REMOVIDO: csrfProtection
router.post('/deactivate-vip', authMiddleware, deactivateVip);  // REMOVIDO: csrfProtection
router.get('/check-vip', authMiddleware, checkVipStatus);
router.post('/process-vip-payment', authMiddleware, processVipPayment);  // REMOVIDO: csrfProtection
router.post('/create-payment-intent', authMiddleware, createPaymentIntent);  // REMOVIDO: csrfProtection
router.post('/webhook/stripe', express.raw({type: 'application/json'}), handleStripeWebhook);  // Sin auth para webhook
// --- NUEVO: Ruta para actualizar imagen de perfil (subida a Cloudinary) ---
router.patch('/update-profile-image', authMiddleware, uploadProfileImageToCloudinary.single('image'), async (req, res) => {
  try {
    // 1. Verificar que se haya subido un archivo
    if (!req.file) {
      return res.status(400).json({ message: 'No se subió ninguna imagen' });
    }

    // 2. Obtener el ID del usuario desde el token (añadido por authMiddleware)
    const userId = req.user.userId;
    
    // 3. Buscar al usuario en la base de datos
    const User = require('../models/User'); // Importa el modelo si no está arriba
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // 4. Subir la imagen (desde la memoria) a Cloudinary
    const cloudinary = require('cloudinary').v2; // Importa Cloudinary si no está arriba
    const result = await new Promise((resolve, reject) => {
      // Crea un stream de subida a Cloudinary
      const stream = cloudinary.uploader.upload_stream(
        { 
          resource_type: 'image', 
          folder: 'profiles' // Organiza las imágenes de perfil en una carpeta 'profiles' en Cloudinary
        },
        (error, result) => {
          if (error) {
            console.error('Error al subir imagen a Cloudinary:', error);
            reject(error);
          } else {
            resolve(result); // Resolve con el resultado de Cloudinary
          }
        }
      );
      // Finaliza el stream pasando el buffer del archivo
      stream.end(req.file.buffer);
    });

    // 5. Guardar la URL pública de la imagen en el documento del usuario
    user.profileImage = result.secure_url; // `secure_url` es la URL HTTPS de Cloudinary
    await user.save(); // Guarda los cambios en MongoDB

    // 6. Devolver la nueva URL de la imagen al frontend
    res.json({ profileImage: user.profileImage });

  } catch (err) {
    // 7. Manejar errores
    console.error('Error al actualizar imagen de perfil:', err);
    res.status(500).json({ message: 'Error interno del servidor al subir la imagen' });
  }
});
// --- FIN NUEVO ---

module.exports = router;