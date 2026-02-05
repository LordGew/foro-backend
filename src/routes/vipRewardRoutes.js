const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { seedVipRewards, getVipRewards, claimVipReward } = require('../controllers/vipRewardController');

// GET /vip-rewards - Get all VIP rewards with unlock status
router.get('/', authMiddleware, getVipRewards);

// POST /vip-rewards/seed - Seed VIP rewards (admin only)
router.post('/seed', authMiddleware, (req, res, next) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Solo administradores pueden ejecutar el seed' });
  }
  next();
}, seedVipRewards);

// POST /vip-rewards/claim/:rewardId - Claim a VIP reward
router.post('/claim/:rewardId', authMiddleware, claimVipReward);

module.exports = router;
