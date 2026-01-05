const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const leaderboardController = require('../controllers/leaderboardController');

// Rutas de leaderboard
router.get('/achievements', leaderboardController.getAchievementLeaderboard);
router.get('/xp', leaderboardController.getXpLeaderboard);
router.get('/posts', leaderboardController.getPostsLeaderboard);
router.get('/referrals', leaderboardController.getReferralsLeaderboard);
router.get('/my-rank', authMiddleware, leaderboardController.getMyRank);

module.exports = router;
