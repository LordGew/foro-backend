const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const achievementController = require('../controllers/achievementController');

// Rutas públicas/autenticadas
router.get('/', achievementController.getAllAchievements);
router.get('/category/:category', achievementController.getAchievementsByCategory);
router.get('/user', authMiddleware, achievementController.getUserAchievementsWithProgress);
router.get('/my-achievements', authMiddleware, achievementController.getMyAchievements);
router.post('/:achievementId/check', authMiddleware, achievementController.checkAchievement);
router.post('/check-all', authMiddleware, achievementController.checkAllAchievements);

// Rutas de administración (solo Admin)
router.post('/', authMiddleware, rbacMiddleware(['Admin']), achievementController.createAchievement);
router.put('/:achievementId', authMiddleware, rbacMiddleware(['Admin']), achievementController.updateAchievement);
router.delete('/:achievementId', authMiddleware, rbacMiddleware(['Admin']), achievementController.deleteAchievement);
router.delete('/reset/:userId', authMiddleware, rbacMiddleware(['Admin']), achievementController.resetUserAchievements);

module.exports = router;
