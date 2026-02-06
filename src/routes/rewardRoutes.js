const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const referralController = require('../controllers/referralController');

// Rutas específicas PRIMERO (antes de rutas con parámetros)
// Obtener mis recompensas
router.get('/my-rewards', authMiddleware, referralController.getMyRewards);

// Limpiar recompensas inválidas del usuario
router.post('/cleanup-invalid', authMiddleware, referralController.cleanupInvalidRewards);

// Reparar recompensas huérfanas (RewardItems eliminados)
router.post('/repair', authMiddleware, referralController.repairUserRewards);

// Debug: Listar todas las recompensas (incluyendo inactivas)
router.get('/debug/all-rewards', authMiddleware, referralController.debugGetAllRewards);

// Mini tienda VIP
router.get('/vip-shop', authMiddleware, referralController.getVipShopItems);
router.post('/vip-shop/:rewardId/claim', authMiddleware, referralController.claimVipShopItem);

// Admin: Forzar seed de recompensas
router.post('/admin/seed', authMiddleware, rbacMiddleware(['Admin']), referralController.seedRewards);

// Rutas con parámetros DESPUÉS
// Comprar una recompensa
router.post('/:rewardId/purchase', authMiddleware, referralController.purchaseReward);

// Equipar una recompensa
router.put('/:rewardId/equip', authMiddleware, referralController.equipReward);

// Desequipar una recompensa
router.delete('/:type/unequip', authMiddleware, referralController.unequipReward);

// Admin: Crear recompensa
router.post('/', authMiddleware, rbacMiddleware(['Admin']), referralController.createReward);

// Admin: Actualizar recompensa
router.put('/:rewardId', authMiddleware, rbacMiddleware(['Admin']), referralController.updateReward);

// Admin: Eliminar recompensa
router.delete('/:rewardId', authMiddleware, rbacMiddleware(['Admin']), referralController.deleteReward);

// Obtener todas las recompensas disponibles (ÚLTIMA para no interferir)
router.get('/', authMiddleware, referralController.getRewards);

module.exports = router;
