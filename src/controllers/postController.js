const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Reply = require('../models/Reply');
const Category = require('../models/Category');
const { sanitizeContent } = require('../utils/sanitize');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const slugify = require('slugify');
const { checkAndGrantAchievements, checkSpecialAchievement } = require('../utils/achievementChecker');

// Role hierarchy ranks (higher number = higher rank)
const roleRanks = {
  'Player': 0,
  'GameMaster': 1,
  'Admin': 2
};

// Helper to check if actor can moderate target
const canModerate = (actorRole, targetRole) => {
  const actorRank = roleRanks[actorRole] || 0;
  const targetRank = roleRanks[targetRole] || 0;
  return actorRank > targetRank;
};

// Función para añadir XP por crear un post
const addPostXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 10 } }, { runValidators: false });  // FIX: Atómico, sin save()
  } catch (err) {
    console.error('Error al añadir XP por post:', err.message);
  }
};

// Función para añadir XP por recibir un like
const addLikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 2 } }, { runValidators: false });  // FIX: Atómico
  } catch (err) {
    console.error('Error al añadir XP por like:', err.message);
  }
};

// Función para quitar XP por quitar un like
const removeLikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: -1 } }, { runValidators: false });  // FIX: Atómico, clamp en schema
  } catch (err) {
    console.error('Error al quitar XP por like:', err.message);
  }
};

// Función para añadir XP por recibir un dislike
const addDislikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: -1 } }, { runValidators: false });  // FIX: Atómico
  } catch (err) {
    console.error('Error al añadir XP por dislike:', err.message);
  }
};

// Función para quitar XP por quitar un dislike
const removeDislikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 1 } }, { runValidators: false });  // FIX: Atómico
  } catch (err) {
    console.error('Error al quitar XP por dislike:', err.message);
  }
};

const createPost = async (req, res) => {
  try {
    const { title, content, category } = req.body;

    // Validar campos requeridos
    if (!title || !content || !category) {
      return res.status(400).json({
        message: 'Faltan campos requeridos',
        required: ['title', 'content', 'category']
      });
    }

    const sanitizedContent = sanitizeContent(content);
    let slug = slugify(title, { lower: true, strict: true });

    // Verifica unicidad del slug
    let existingPost = await Post.findOne({ slug });
    let counter = 1;
    while (existingPost) {
      slug = `${slugify(title, { lower: true, strict: true })}-${counter}`;
      existingPost = await Post.findOne({ slug });
      counter++;
    }

    const post = new Post({
      title,
      content: sanitizedContent,
      category,
      author: req.user.userId,
      slug // Agregar slug al post
    });

    // Manejar la imagen si existe
    if (req.file) {
      post.images = [req.file.path];
    }

    await post.save();

    // Aumentar contador de posts y añadir XP en una sola operación atomic (FIX: evita negativos y race conditions)
    await User.updateOne(
      { _id: req.user.userId },
      { 
        $inc: { 
          postCount: 1,  // Incrementa postCount
          xp: 10  // +10 XP
        },
        lastLogin: new Date()
      },
      { runValidators: true }  // Valida después de update
    );
    // Verificar logros especiales basados en hora de publicación
    const postHour = new Date().getHours();
    if (postHour < 6) {
      await checkSpecialAchievement(req.user.userId, 'early_bird');
    } else if (postHour >= 0 && postHour < 3) {
      await checkSpecialAchievement(req.user.userId, 'night_owl');
    }

    // Verificar logros generales (posts, XP, etc.)
    await checkAndGrantAchievements(req.user.userId, 'post_created');

    // Actualizar progreso de misiones
    const missionController = require('./missionController');
    await missionController.updateMissionProgress(req.user.userId, 'create_post', 1);
    await missionController.updateMissionProgress(req.user.userId, 'earn_xp', 10);
    res.status(201).json(post);
  } catch (err) {
    console.error('Error al crear post:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(err => err.message);
      return res.status(400).json({ message: 'Error de validación', errors: messages });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'La imagen no debe superar los 5MB' });
    }
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const getPosts = async (req, res) => {
  try {
    const { category, author, dateFrom, dateTo, search, game } = req.query;
    let query = {};
    
    if (category) query.category = category;
    if (author) query.author = author;
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // NUEVO: Filtrar por juego si se proporciona
    let posts;
    if (game) {
      // Primero obtener las categorías del juego
      const categories = await Category.find({ game: game }).select('_id');
      const categoryIds = categories.map(cat => cat._id);
      
      // Agregar filtro de categorías al query
      if (categoryIds.length > 0) {
        query.category = { $in: categoryIds };
      } else {
        // Si no hay categorías para este juego, retornar array vacío
        return res.json([]);
      }
    }

    posts = await Post.find(query)
      .populate('author', 'username profileImage _id role vip')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(20);
    // FIX: Filtrar posts VIP solo para autorizados (Admin, GameMaster o VIP)
    const authorized = req.user && (req.user.role === 'Admin' || req.user.role === 'GameMaster' || req.user.vip);
    const filteredPosts = posts.filter(post => 
      !post.category || post.category.name !== 'VIP' || authorized
    );
      
    res.json(filteredPosts);
  } catch (err) {
    console.error('Error al obtener posts:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const updatePost = async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const updates = {};
    
    if (title) updates.title = title;
    if (content) updates.content = sanitizeContent(content);
    if (category) updates.category = category;
    
    // Manejar la imagen si existe
    if (req.file) {
      updates.images = [req.file.path];  // Use req.file.path for the Cloudinary URL
      
      // Eliminar imagen anterior de Cloudinary si existe
      const post = await Post.findById(req.params.id);
      if (post && post.images && post.images.length > 0) {
        const oldUrl = post.images[0];
        const publicId = getPublicIdFromUrl(oldUrl);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
        }
      }
    }
    
    const post = await Post.findByIdAndUpdate(
      req.params.id, 
      updates, 
      { 
        new: true,
        runValidators: true
      }
    );
    
    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }
    
    res.json(post);
  } catch (err) {
    console.error('Error al actualizar post:', err);
    
    // Manejar errores de validación específicos
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Error de validación', 
        errors: messages 
      });
    }
    
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

// Helper function to extract public_id from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  // Example URL: https://res.cloudinary.com/cloudname/image/upload/v1234567890/wow-forum/public-id.jpg  
  const parts = url.split('/');
  const uploadIndex = parts.findIndex(part => part === 'upload');
  if (uploadIndex === -1) return null;
  // Join parts after 'upload/' and remove extension
  const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
  return publicIdWithExt.replace(/\.[^/.]+$/, '');
};

const likePost = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Usuario no autenticado', error: 'no_user' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });

    if (!post.author || !mongoose.Types.ObjectId.isValid(post.author)) {
      return res.status(400).json({ message: 'Post sin autor válido' });
    }

    const userId = req.user.userId;

    const likeIndex = post.likes.findIndex(like => like.toString() === userId);
    const dislikeIndex = post.dislikes.findIndex(dislike => dislike.toString() === userId);
    
    if (likeIndex === -1) {
      post.likes.push(userId);
      await addLikeXp(post.author.toString());
      if (dislikeIndex !== -1) {
        post.dislikes.splice(dislikeIndex, 1);
        await removeDislikeXp(post.author.toString());
      }
    } else {
      post.likes.splice(likeIndex, 1);
      await removeLikeXp(post.author.toString());
    }

    await post.save();
    const updatedPost = await Post.findById(req.params.id)
      .populate('author', 'username profileImage')
      .populate('category', 'name')
      .populate('replies', 'content author likes dislikes createdAt')
      .populate('likes', 'username profileImage')
      .populate('dislikes', 'username profileImage');

    res.json(updatedPost);
  } catch (err) {
    console.error('Error al manejar like en post:', err.message);
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token inválido o expirado', error: 'invalid_token' });
    }
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const dislikePost = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Usuario no autenticado', error: 'no_user' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });

    if (!post.author || !mongoose.Types.ObjectId.isValid(post.author)) {
      return res.status(400).json({ message: 'Post sin autor válido' });
    }

    const userId = req.user.userId;

    const likeIndex = post.likes.findIndex(like => like.toString() === userId);
    const dislikeIndex = post.dislikes.findIndex(dislike => dislike.toString() === userId);
    
    if (dislikeIndex === -1) {
      post.dislikes.push(userId);
      await addDislikeXp(post.author.toString());
      if (likeIndex !== -1) {
        post.likes.splice(likeIndex, 1);
        await removeLikeXp(post.author.toString());
      }
    } else {
      post.dislikes.splice(dislikeIndex, 1);
      await removeDislikeXp(post.author.toString());
    }

    await post.save();
    const updatedPost = await Post.findById(req.params.id)
      .populate('author', 'username profileImage')
      .populate('category', 'name')
      .populate('replies', 'content author likes dislikes createdAt')
      .populate('likes', 'username profileImage')
      .populate('dislikes', 'username profileImage');

    res.json(updatedPost);
  } catch (err) {
    console.error('Error al manejar dislike en post:', err.message);
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token inválido o expirado', error: 'invalid_token' });
    }
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getPostsCount = async (req, res) => {
  try {
    const { game } = req.query;
    let query = {};
    
    // Filtrar por juego si se proporciona
    if (game) {
      const categories = await Category.find({ game: game }).select('_id');
      const categoryIds = categories.map(cat => cat._id);
      
      if (categoryIds.length > 0) {
        query.category = { $in: categoryIds };
      } else {
        // Si no hay categorías para este juego, retornar 0
        return res.json({ count: 0 });
      }
    }
    
    const count = await Post.countDocuments(query);
    res.json({ count });
  } catch (err) {
    console.error('Error al contar posts:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const deletePostByAdmin = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    // Eliminar el post
    await Post.findByIdAndDelete(req.params.id);
    
    // Actualizar contador de posts del usuario
    await User.findByIdAndUpdate(post.author, { 
      $inc: { postCount: -1 } 
    });

    // Eliminar todas las respuestas asociadas al post
    await Reply.deleteMany({ post: req.params.id });

    res.json({ message: 'Post eliminado por administrador' });
  } catch (err) {
    console.error('Error al eliminar post (admin):', err);
    res.status(500).json({ 
      message: 'Error interno del servidor', 
      error: err.message 
    });
  }
};
const getPostById = async (req, res) => {
  try {
    const { param } = req.params;  
    
    let post;
    if (mongoose.Types.ObjectId.isValid(param)) {
      // Buscar por ID
      post = await Post.findById(param)
        .populate('author', 'username profileImage _id role vip')
        .populate('category', 'name')
        .populate('replies', 'content author likes dislikes createdAt');
    } else {
      // Buscar por slug
      post = await Post.findOne({ slug: param })
        .populate('author', 'username profileImage _id role vip')
        .populate('category', 'name')
        .populate('replies', 'content author likes dislikes createdAt');
    }

    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    // Verificar acceso VIP
    const authorized = req.user && (req.user.role === 'Admin' || req.user.role === 'GameMaster' || req.user.vip);
    if (post.category && post.category.name === 'VIP' && !authorized) {
      return res.status(403).json({ message: 'Acceso denegado a contenido VIP' });
    }

    res.json(post);
  } catch (err) {
    console.error('Error al obtener post por ID/slug:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getPostsByCategoryParam = async (req, res) => {
  try {
    const param = req.params.id || req.params.param;
    let category;
    if (mongoose.Types.ObjectId.isValid(param)) {
      category = await Category.findById(param);
    } else {
      category = await Category.findOne({ slug: param });
    }

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    const posts = await Post.find({ category: category._id })
      .populate([
        { 
          path: 'author', 
          select: 'username profileImage _id role vip',
          transform: (doc) => {
            if (doc && doc.profileImage && !doc.profileImage.startsWith('http')) {
              doc.profileImage = `https://res.cloudinary.com/duqywugjo/image/upload/v1759376255/profiles/${doc.profileImage}`;
            }
            return doc;
          }
        },
        { path: 'category', select: 'name slug' },
        {
          path: 'replies',
          populate: [
            { path: 'author', select: 'username profileImage _id role vip' },
            { path: 'likes', select: 'username' },
            { path: 'dislikes', select: 'username' },
            { path: 'parentReply', populate: { path: 'author', select: 'username profileImage _id role vip' } }
          ],
          options: { sort: { createdAt: 1 } }
        },
        { path: 'likes', select: 'username profileImage' },
        { path: 'dislikes', select: 'username profileImage' }
      ])
      .sort({ createdAt: -1 });

    const authorized = req.user && (req.user.role === 'Admin' || req.user.role === 'GameMaster' || req.user.vip);
    if (category.name.toUpperCase() === 'VIP' && !authorized) {
      return res.status(403).json({ message: 'Acceso denegado a contenido VIP' });
    }
    res.json(posts);
  } catch (err) {
    console.error('Error al obtener posts por categoría:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
  
};

module.exports = { 
  createPost, 
  getPosts, 
  getPostById,
  updatePost, 
  deletePost: deletePostByAdmin,  
  likePost,
  dislikePost,
  addPostXp,
  getPostsCount,
  deletePostByAdmin,
  getPostsByCategoryParam
};