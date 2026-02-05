const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const referralController = require('../controllers/referralController');

// Rutas de referidos (requieren autenticación)
router.get('/my-code', authMiddleware, referralController.getMyReferralCode);
router.post('/apply', authMiddleware, referralController.applyReferralCode);
router.get('/my-referrals', authMiddleware, referralController.getMyReferrals);

// Rutas de recompensas
router.get('/rewards', authMiddleware, referralController.getRewards);
router.get('/my-rewards', authMiddleware, referralController.getMyRewards);
router.post('/cleanup-invalid', authMiddleware, referralController.cleanupInvalidRewards);
router.post('/clear-all-rewards', authMiddleware, referralController.clearAllRewards);
router.post('/rewards/:rewardId/purchase', authMiddleware, referralController.purchaseReward);
router.put('/rewards/:rewardId/equip', authMiddleware, referralController.equipReward);
router.delete('/rewards/:type/unequip', authMiddleware, referralController.unequipReward);

// Rutas de administración (solo Admin)
router.post('/rewards', authMiddleware, rbacMiddleware(['Admin']), referralController.createReward);
router.put('/rewards/:rewardId', authMiddleware, rbacMiddleware(['Admin']), referralController.updateReward);
router.delete('/rewards/:rewardId', authMiddleware, rbacMiddleware(['Admin']), referralController.deleteReward);

// Ruta de mantenimiento para actualizar iconos (solo Admin)
router.post('/update-reward-icons', authMiddleware, rbacMiddleware(['Admin']), referralController.updateRewardIcons);

// Ruta temporal para actualizar iconos (sin autenticación - para desarrollo)
router.post('/update-reward-icons-temp', referralController.updateRewardIcons);

// Nuevas rutas para validación de referidos
router.get('/check-status', authMiddleware, referralController.checkReferralStatus);
router.post('/validate-pending', authMiddleware, rbacMiddleware(['Admin']), referralController.validatePendingReferrals);

module.exports = router;
