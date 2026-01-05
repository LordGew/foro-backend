const express = require('express');
const router = express.Router();
const { 
  updateForumSettings, 
  getForumSettings,
  getUsers,
  fixCategoriesGame,
  applyManualReferral,
  migrateRoles
} = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');

router.put('/settings', authMiddleware, rbacMiddleware('Admin'), updateForumSettings);
router.get('/settings', getForumSettings);
router.get('/users', authMiddleware, rbacMiddleware('Admin'), getUsers);
router.post('/fix-categories-game', authMiddleware, rbacMiddleware('Admin'), fixCategoriesGame);
router.post('/apply-manual-referral', authMiddleware, rbacMiddleware('Admin'), applyManualReferral);
router.post('/migrate-roles', authMiddleware, rbacMiddleware('Admin'), migrateRoles);

module.exports = router;