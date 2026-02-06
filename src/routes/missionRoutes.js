const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

// Importar el controlador
const missionController = require('../controllers/missionController');

// Middleware para logging de requests
router.use((req, res, next) => {
  next();
});

// Obtener misiones del día
router.get('/today', authMiddleware, missionController.getTodayMissions);

// Reclamar recompensa de misión
router.post('/:missionId/claim', authMiddleware, missionController.claimMissionReward);

// Validar y reclamar todas las recompensas disponibles
router.post('/validate-claim', authMiddleware, missionController.validateAndClaimAll);

// Forzar actualización de progreso de login (para debugging)
router.post('/force-login', authMiddleware, missionController.forceLoginProgress);

// Obtener información de depuración
router.get('/debug', authMiddleware, missionController.getDebugInfo);

// Resetear progreso de prueba (solo desarrollo)
router.post('/reset-test', authMiddleware, missionController.resetTestProgress);

// Endpoint para generar misiones manualmente (admin)
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    
    const missions = await missionController.generateDailyMissions();
    res.json({
      success: true,
      message: 'Misiones generadas exitosamente',
      missions: missions.length
    });
  } catch (error) {
    console.error('Error generando misiones manualmente:', error);
    res.status(500).json({ message: 'Error generando misiones', error: error.message });
  }
});

// Endpoint para validar integridad de todas las misiones
router.get('/validate-integrity', authMiddleware, async (req, res) => {
  try {
    const DailyMission = require('../models/DailyMission');
    const UserMissionProgress = require('../models/UserMissionProgress');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Validar misiones del día
    const missions = await DailyMission.find({ date: today });
    const missionValidation = missions.map(mission => {
      const validation = mission.validateIntegrity();
      return {
        missionId: mission._id,
        type: mission.type,
        title: mission.title,
        isValid: validation.isValid,
        errors: validation.errors
      };
    });
    
    // Validar progreso del usuario
    const progress = await UserMissionProgress.find({
      userId: req.user.userId,
      date: today
    });
    
    const progressValidation = progress.map(p => {
      const validation = p.validateIntegrity();
      return {
        progressId: p._id,
        missionId: p.missionId,
        progress: p.progress,
        completed: p.completed,
        claimed: p.claimed,
        isValid: validation.isValid,
        errors: validation.errors
      };
    });
    
    res.json({
      success: true,
      date: today.toISOString(),
      missions: missionValidation,
      progress: progressValidation,
      summary: {
        totalMissions: missions.length,
        validMissions: missionValidation.filter(m => m.isValid).length,
        totalProgress: progress.length,
        validProgress: progressValidation.filter(p => p.isValid).length
      }
    });
  } catch (error) {
    console.error('Error validando integridad:', error);
    res.status(500).json({ message: 'Error validando integridad', error: error.message });
  }
});

module.exports = router;
