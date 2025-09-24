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
// REMOVIDO: csrfProtection = require('csurf'); - No se usa más

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/profiles/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
  }
});

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
router.patch('/update-profile-image', authMiddleware, upload.single('image'), updateProfileImage);  // REMOVIDO: csrfProtection

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


module.exports = router;