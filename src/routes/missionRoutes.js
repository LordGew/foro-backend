const express = require('express');
const router = express.Router();
const missionController = require('../controllers/missionController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rutas de misiones diarias
router.get('/', authMiddleware, missionController.getTodayMissions);
router.get('/today', authMiddleware, missionController.getTodayMissions);
router.post('/:missionId/claim', authMiddleware, missionController.claimMissionReward);
router.get('/stats', authMiddleware, missionController.getMissionStats);
router.post('/validate-claim', (req, res, next) => {
  console.log('🚀 ENDPOINT VALIDATE-CLAIM RECIBIDO');
  console.log('📋 Headers:', req.headers);
  console.log('📋 Body:', req.body);
  console.log('📋 User:', req.user);
  next();
}, authMiddleware, missionController.validateAndClaimRewards);

module.exports = router;
