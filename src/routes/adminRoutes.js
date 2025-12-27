const express = require('express');
const router = express.Router();
const { 
  updateForumSettings, 
  getForumSettings,
  getUsers,
  fixCategoriesGame
} = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');

router.put('/settings', authMiddleware, rbacMiddleware('Admin'), updateForumSettings);
router.get('/settings', getForumSettings);
router.get('/users', authMiddleware, rbacMiddleware('Admin'), getUsers);
router.post('/fix-categories-game', authMiddleware, rbacMiddleware('Admin'), fixCategoriesGame);

module.exports = router;