// userRoutes.js
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
  updateProfileImage
} = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const multer = require('multer');
const path = require('path');

// Configuración de Multer para subida de imágenes de perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/profiles/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

// Registro y login (públicos)
router.post('/register', register);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);

// Perfil y seguridad (requieren autenticación)
router.get('/profile', authMiddleware, getUserProfile);
router.patch('/update-password', authMiddleware, updatePassword);
router.put('/profile', authMiddleware, updateProfile);
router.patch('/update-profile-image', authMiddleware, upload.single('image'), updateProfileImage);

// Admin: gestión de usuarios
router.put('/:id/role', authMiddleware, rbacMiddleware('Admin'), changeRole);
router.put('/:id/ban', authMiddleware, rbacMiddleware('Admin'), banUser);
router.put('/:id/unban', authMiddleware, rbacMiddleware('Admin'), unbanUser);
router.put('/:id/mute', authMiddleware, rbacMiddleware('Admin'), muteUser);
router.put('/:id/unmute', authMiddleware, rbacMiddleware('Admin'), unmuteUser);

module.exports = router;