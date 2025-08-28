const express = require('express');
const router = express.Router();
const { createReply, getReplies, updateReply, deleteReply } = require('../controllers/replyController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');

router.post('/:postId', authMiddleware, createReply);
router.get('/:postId', getReplies);
router.put('/:id', authMiddleware, updateReply);
router.delete('/:id', authMiddleware, rbacMiddleware(['GameMaster', 'Admin']), deleteReply);

module.exports = router;