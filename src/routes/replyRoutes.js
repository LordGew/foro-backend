const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createReply, getReplies, getAllReplies, updateReply, deleteReply, toggleLike, toggleDislike } = require('../controllers/replyController');
const authMiddleware = require('../middlewares/authMiddleware');

const uploadReplyImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
  }
});

router.post('/:postId', authMiddleware, uploadReplyImages.array('images', 5), createReply);
router.get('/:postId', getReplies);
router.get('/', getAllReplies);
router.put('/:id', authMiddleware, updateReply);
router.delete('/:id', authMiddleware, deleteReply);
router.post('/:id/like', authMiddleware, toggleLike);
router.post('/:id/dislike', authMiddleware, toggleDislike);




module.exports = router;