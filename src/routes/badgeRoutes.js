const express = require('express');
const router = express.Router();
const badgeController = require('../controllers/badgeController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');

// Rutas específicas PRIMERO (antes de rutas con parámetros)
// Admin: Forzar seed de badges
router.post('/admin/seed', authMiddleware, rbacMiddleware(['Admin']), badgeController.seedBadges);

// Rutas con parámetros DESPUÉS
// Rutas públicas/autenticadas
router.get('/', badgeController.getAllBadges);
router.get('/user/:userId', badgeController.getUserBadges);
router.post('/:badgeId/purchase', authMiddleware, badgeController.purchaseBadge);

// Rutas de administración
router.post('/', authMiddleware, rbacMiddleware(['Admin']), badgeController.createBadge);
router.put('/:badgeId', authMiddleware, rbacMiddleware(['Admin']), badgeController.updateBadge);
router.delete('/:badgeId', authMiddleware, rbacMiddleware(['Admin']), badgeController.deleteBadge);

module.exports = router;
