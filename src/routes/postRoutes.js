// src/routes/postRoutes.js
const express = require('express');
const router = express.Router();
const { createPost, getPosts, getPostById, updatePost, deletePost, likePost } = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const uploadSingleImage = require('../middlewares/uploadMiddleware'); 

// Upload primero, luego auth
router.post('/', uploadSingleImage, authMiddleware, createPost);
router.get('/', getPosts);
router.get('/:id', getPostById);
router.put('/:id', uploadSingleImage, authMiddleware, updatePost);
router.delete('/:id', authMiddleware, rbacMiddleware(['GameMaster', 'Admin']), deletePost);
router.post('/:id/like', authMiddleware, likePost);

// NUEVA: Ruta para crear respuestas desde /api/posts/{id}/replies
router.post('/:id/replies', authMiddleware, (req, res, next) => {
  // Asegurarse de que req.body esté disponible
  if (!req.body) {
    return res.status(400).json({ message: 'No se recibió el cuerpo de la solicitud' });
  }
  
  // Reenviar la solicitud a /api/replies/:postId
  req.params.postId = req.params.id;
  next();
}, require('../controllers/replyController').createReply);

module.exports = router;