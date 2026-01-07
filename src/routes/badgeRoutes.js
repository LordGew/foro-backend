const express = require('express');
const router = express.Router();
const badgeController = require('../controllers/badgeController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');

// Rutas públicas/autenticadas
router.get('/', badgeController.getAllBadges);
router.get('/user/:userId', badgeController.getUserBadges);
router.post('/:badgeId/purchase', authMiddleware, badgeController.purchaseBadge);

// Rutas de administración
router.post('/', authMiddleware, rbacMiddleware(['Admin']), badgeController.createBadge);
router.put('/:badgeId', authMiddleware, rbacMiddleware(['Admin']), badgeController.updateBadge);
router.delete('/:badgeId', authMiddleware, rbacMiddleware(['Admin']), badgeController.deleteBadge);

module.exports = router;
