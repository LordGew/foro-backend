const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Category = require('../models/Category');
const authMiddleware = require('../middlewares/authMiddleware');

// Obtener posts por categoría
router.get('/category/:categoryId', authMiddleware, async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const user = req.user;

    console.log('Obteniendo posts para categoría:', categoryId, 'Usuario:', { userId: user.userId, role: user.role, vip: user.vip });

    // Verificar si la categoría existe
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Permitir acceso a categoría VIP si el usuario es Admin, GameMaster o VIP activo
    const isVipCategory = category.name.toLowerCase().includes('vip');
    if (isVipCategory && user.role !== 'Admin' && user.role !== 'GameMaster' && !user.vip) {
      return res.status(403).json({ message: 'Acceso denegado a categoría VIP', error: 'unauthorized' });
    }

    const posts = await Post.find({ category: categoryId })
      .populate('author', 'username profileImage')
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    console.error('Error al obtener posts por categoría:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
});

// Otras rutas (like, dislike, etc.)
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });

    const userId = req.user.userId;
    console.log('Like request - User:', userId, 'Post:', req.params.id);

    if (post.likes.includes(userId)) {
      post.likes = post.likes.filter(id => id.toString() !== userId);
    } else {
      post.likes.push(userId);
      post.dislikes = post.dislikes.filter(id => id.toString() !== userId);
    }
    await post.save();
    res.json(post);
  } catch (err) {
    console.error('Error al dar like:', err);
    res.status(500).json({ message: 'Error al procesar el like', error: err.message });
  }
});

router.post('/:id/dislike', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });

    const userId = req.user.userId;
    console.log('Dislike request - User:', userId, 'Post:', req.params.id);

    if (post.dislikes.includes(userId)) {
      post.dislikes = post.dislikes.filter(id => id.toString() !== userId);
    } else {
      post.dislikes.push(userId);
      post.likes = post.likes.filter(id => id.toString() !== userId);
    }
    await post.save();
    res.json(post);
  } catch (err) {
    console.error('Error al dar dislike:', err);
    res.status(500).json({ message: 'Error al procesar el dislike', error: err.message });
  }
});

// Otras rutas (crear, eliminar posts, etc.) - Añade según tu implementación
router.get('/:slug', async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug })
      .populate('author', 'username profileImage')
      .populate('category', 'name');
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: 'Error al cargar el post', error: err.message });
  }
});

module.exports = router;