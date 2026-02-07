const express = require('express');
const router = express.Router();


const {
  createBanner, getBanners, updateBanner, deleteBanner,
  reorderBanners, recordView, setDuration, setRemaining, updateTextConfig
} = require('../controllers/bannerController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const uploadSingleImage = require('./../middlewares/uploadMiddleware');

// Crear banner (requiere admin)
router.post('/', authMiddleware, rbacMiddleware('Admin'), uploadSingleImage, createBanner);

// Obtener banners por ubicación (público) - MODIFICADO: usa query parameter
router.get('/', getBanners); // Ahora: /api/banners?location=sidebar

// Registrar una visualización (público, invocado por frontend cuando se muestra)
router.post('/:id/view', recordView); // Corregido el nombre del endpoint

// Setear duración y remaining (admin)
router.put('/:id/duration', authMiddleware, rbacMiddleware('Admin'), setDuration);
router.put('/:id/remaining', authMiddleware, rbacMiddleware('Admin'), setRemaining);

// Actualizar texto del banner (admin)
router.put('/:id/text', authMiddleware, rbacMiddleware('Admin'), updateTextConfig);

// Actualizar banner (admin)
router.put('/:id', authMiddleware, rbacMiddleware('Admin'), upload, updateBanner);

// Eliminar banner (admin)
router.delete('/:id', authMiddleware, rbacMiddleware('Admin'), deleteBanner);

// Reordenar banners (admin)
router.post('/reorder', authMiddleware, rbacMiddleware('Admin'), reorderBanners);

module.exports = router;