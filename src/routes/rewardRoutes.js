const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const referralController = require('../controllers/referralController');

// Obtener todas las recompensas disponibles
router.get('/', authMiddleware, referralController.getRewards);

// Obtener mis recompensas
router.get('/my-rewards', authMiddleware, referralController.getMyRewards);

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

module.exports = router;
