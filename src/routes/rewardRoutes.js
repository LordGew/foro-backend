const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const referralController = require('../controllers/referralController');

// Obtener todas las recompensas disponibles
router.get('/', authMiddleware, referralController.getRewards);

// Obtener mis recompensas (DEBE IR ANTES DE /:rewardId/equip para evitar conflicto de rutas)
router.get('/my-rewards', authMiddleware, referralController.getMyRewards);

// Debug: Listar todas las recompensas (incluyendo inactivas)
router.get('/debug/all-rewards', authMiddleware, referralController.debugGetAllRewards);

// Comprar una recompensa
router.post('/:rewardId/purchase', authMiddleware, referralController.purchaseReward);

// Equipar una recompensa
router.put('/:rewardId/equip', authMiddleware, referralController.equipReward);

// Desequipar una recompensa
router.delete('/:type/unequip', authMiddleware, referralController.unequipReward);

// Admin: Forzar seed de recompensas
router.post('/admin/seed', authMiddleware, rbacMiddleware(['Admin']), referralController.seedRewards);

// Admin: Crear recompensa
router.post('/', authMiddleware, rbacMiddleware(['Admin']), referralController.createReward);

// Admin: Actualizar recompensa
router.put('/:rewardId', authMiddleware, rbacMiddleware(['Admin']), referralController.updateReward);

// Admin: Eliminar recompensa
router.delete('/:rewardId', authMiddleware, rbacMiddleware(['Admin']), referralController.deleteReward);

module.exports = router;
