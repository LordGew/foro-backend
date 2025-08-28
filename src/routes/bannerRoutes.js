const express = require('express');
const router = express.Router();

const { createBanner, getBanners, updateBanner, deleteBanner, reorderBanners } = require('../controllers/bannerController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const upload = require('../middlewares/uploadMiddleware'); // ← middleware listo para usar

// Crear banner (requiere admin)
router.post('/', authMiddleware, rbacMiddleware('Admin'), upload, createBanner);

// Obtener banners por ubicación
router.get('/:location', getBanners);

// Actualizar banner
router.put('/:id', authMiddleware, rbacMiddleware('Admin'), upload, updateBanner);

// Eliminar banner
router.delete('/:id', authMiddleware, rbacMiddleware('Admin'), deleteBanner);

// Reordenar banners
router.post('/reorder', authMiddleware, rbacMiddleware('Admin'), reorderBanners);

module.exports = router;