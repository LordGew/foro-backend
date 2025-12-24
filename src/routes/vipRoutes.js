const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  getVipTransactions,
  getVipBenefits,
  updateVipBenefits
} = require('../controllers/vipController');

router.get('/transactions', authMiddleware, getVipTransactions);

router.get('/benefits', authMiddleware, getVipBenefits);

router.patch('/benefits', authMiddleware, updateVipBenefits);

module.exports = router;
