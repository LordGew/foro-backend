const express = require('express');
const router = express.Router();
const { createReply, getReplies, getAllReplies, updateReply, deleteReply, toggleLike, toggleDislike } = require('../controllers/replyController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/:postId', authMiddleware, createReply);
router.get('/:postId', getReplies);
router.get('/', getAllReplies);
router.put('/:id', authMiddleware, updateReply);
router.delete('/:id', authMiddleware, deleteReply);
router.post('/:id/like', authMiddleware, toggleLike);
router.post('/:id/dislike', authMiddleware, toggleDislike);




module.exports = router;