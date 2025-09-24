// src/routes/postRoutes.js
const express = require('express');
const router = express.Router();
const { createPost, getPosts, getPostById, updatePost, deletePost, likePost, dislikePost, getPostsByCategory,getPostsCount, deletePostByAdmin,getPostByParam } = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const uploadSingleImage = require('../middlewares/uploadMiddleware'); 

// Upload primero, luego auth
router.post('/', uploadSingleImage, authMiddleware, createPost);
router.get('/', getPosts);
router.get('/count', getPostsCount); // Añadida ruta para GET /api/posts/count
router.get('/:param', authMiddleware, getPostByParam);  // FIX: Agrega authMiddleware para VIP check
router.get('/category/:id', authMiddleware, getPostsByCategory);
router.put('/:id', uploadSingleImage, authMiddleware, updatePost);
router.delete('/:id', authMiddleware, rbacMiddleware(['GameMaster', 'Admin']), deletePost);
router.delete('/admin/:id', authMiddleware, rbacMiddleware('Admin'), deletePostByAdmin);
router.post('/:id/like', authMiddleware, likePost);
router.post('/:id/dislike', authMiddleware, dislikePost);


// NUEVA: Ruta para crear respuestas desde /api/posts/{id}/replies
router.post('/:id/replies', authMiddleware, (req, res, next) => {
  console.log('postRoutes /:id/replies hit! Forwarding to createReply with postId:', req.params.id);  // 👈 NUEVO: Debug forwarding
  // Asegurarse de que req.body esté disponible
  if (!req.body) {
    return res.status(400).json({ message: 'No se recibió el cuerpo de la solicitud' });
  }
  
  // Reenviar la solicitud a /api/replies/:postId
  req.params.postId = req.params.id;
  next();
}, require('../controllers/replyController').createReply);

// NUEVA: Ruta para obtener respuestas desde /api/posts/{id}/replies
router.get('/:id/replies', authMiddleware, (req, res, next) => {
  console.log('postRoutes GET /:id/replies hit! Forwarding to getReplies with postId:', req.params.id);  // 👈 NUEVO: Debug forwarding
  // Reenviar la solicitud a /api/replies/:postId
  req.params.postId = req.params.id;
  next();
}, require('../controllers/replyController').getReplies);

module.exports = router;