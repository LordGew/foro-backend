const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const uploadSingleImage = require('../middlewares/uploadMiddleware');
const {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  dislikePost,
  getPostsByCategory,
  getPostsCount,
  deletePostByAdmin,
  getPostByParam
} = require('../controllers/postController');

// Crear post (upload primero, luego auth)
router.post('/', uploadSingleImage, authMiddleware, createPost);

// Obtener posts
router.get('/', getPosts);

// Obtener conteo de posts (nueva ruta)
router.get('/count', getPostsCount);

// Obtener posts por categoría
router.get('/category/:id', authMiddleware, getPostsByCategory);

// Obtener post por ID o slug
router.get('/:param', authMiddleware, getPostByParam);

// Actualizar post
router.put('/:id', uploadSingleImage, authMiddleware, updatePost);

// Eliminar post (autor o moderador)
router.delete('/:id', authMiddleware, rbacMiddleware(['GameMaster', 'Admin']), deletePost);

// Eliminar post por admin
router.delete('/admin/:id', authMiddleware, rbacMiddleware('Admin'), deletePostByAdmin);

// Like post
router.post('/:id/like', authMiddleware, likePost);

// Dislike post
router.post('/:id/dislike', authMiddleware, dislikePost);

// Ruta para crear respuestas (reenvía a replyRoutes, pero como frontend llama /posts/:id/replies, agregamos esta ruta)
router.post('/:id/replies', authMiddleware, (req, res, next) => {
  req.params.postId = req.params.id;
  next();
}, require('../controllers/replyController').createReply);

// Ruta para obtener respuestas (reenvía a replyRoutes)
router.get('/:id/replies', authMiddleware, (req, res, next) => {
  req.params.postId = req.params.id;
  next();
}, require('../controllers/replyController').getReplies);

module.exports = router;