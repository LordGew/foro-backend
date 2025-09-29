const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  createPost,
  getPosts,
  updatePost,
  deletePost,
  likePost,
  dislikePost,
  getPostsByCategory,
  getPostsCount,
  deletePostByAdmin,
  getPostByParam
} = require('../controllers/postController');

// Crear un post (requiere autenticación)
router.post('/', authMiddleware, createPost);

// Obtener conteo de posts
router.get('/count', getPostsCount);

// Obtener posts por categoría
router.get('/category/:id', authMiddleware, getPostsByCategory);

// Obtener todos los posts con filtros opcionales
router.get('/', getPosts);

// Obtener un post por slug o ID
router.get('/:param', getPostByParam);

// Actualizar un post (requiere autenticación)
router.put('/:id', authMiddleware, updatePost);

// Eliminar un post (requiere autenticación, autor o moderador)
router.delete('/:id', authMiddleware, deletePost);

// Eliminar un post por admin
router.delete('/admin/:id', authMiddleware, deletePostByAdmin);

// Dar like a un post (requiere autenticación)
router.post('/:id/like', authMiddleware, likePost);

// Dar dislike a un post (requiere autenticación)
router.post('/:id/dislike', authMiddleware, dislikePost);

module.exports = router;