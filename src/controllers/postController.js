const Post = require('../models/Post');
const User = require('../models/User');
const { sanitizeContent } = require('../utils/sanitize');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

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
    const user = await User.findById(userId);
    if (!user) return;
    
    user.xp = (user.xp || 0) + 10;
    await user.save();
    
    console.log(`+10 XP a usuario ${user.username} por crear post`);
    return user;
  } catch (err) {
    console.error('Error al añadir XP por post:', err);
    throw err;
  }
};

// Función para añadir XP por recibir un like
const addLikeXp = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    user.xp = (user.xp || 0) + 2;
    await user.save();
    
    console.log(`+2 XP a usuario ${user.username} por recibir like`);
    return user;
  } catch (err) {
    console.error('Error al añadir XP por like:', err);
    throw err;
  }
};

// Función para quitar XP por quitar un like
const removeLikeXp = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    user.xp = Math.max(0, (user.xp || 0) - 1);
    await user.save();
    
    console.log(`-1 XP a usuario ${user.username} por quitar like`);
    return user;
  } catch (err) {
    console.error('Error al quitar XP por like:', err);
    throw err;
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
    const post = new Post({ 
      title, 
      content: sanitizedContent, 
      category,
      author: req.user.userId 
    });
    
    // Manejar la imagen si existe
    if (req.file) {
      post.images = [req.file.path];  // Use req.file.path for the Cloudinary URL
    }
    
    await post.save();
    
    // Aumentar contador de posts
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { postCount: 1 },
      lastLogin: new Date()
    });
    
    // Añadir XP al usuario por crear el post
    await addPostXp(req.user.userId);
    
    res.status(201).json(post);
  } catch (err) {
    console.error('Error al crear post:', err);
    
    // Manejar errores específicos
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Error de validación', 
        errors: messages 
      });
    }
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'La imagen no debe superar los 5MB' 
      });
    }
    
    if (err.message && err.message.includes('Solo se permiten imágenes')) {
      return res.status(400).json({ 
        message: err.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });
    
    const targetUser = await User.findById(post.author);
    
    // Verificar que el usuario sea el autor o un moderador autorizado
    if (post.author.toString() !== req.user.userId) {
      if (req.user.role !== 'Admin') {  // Admins can delete anything
        if (!canModerate(req.user.role, targetUser.role)) {
          return res.status(403).json({ message: 'No autorizado' });
        }
      }
    }
    
    // Eliminar imagen de Cloudinary si existe
    if (post.images && post.images.length > 0) {
      const publicId = getPublicIdFromUrl(post.images[0]);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Imagen eliminada de Cloudinary: ${publicId}`);
      }
    }
    
    // Disminuir contador de posts
    await User.findByIdAndUpdate(post.author, {
      $inc: { postCount: -1 },
      lastLogin: new Date()
    });
    
    await post.deleteOne();
    res.json({ message: 'Post eliminado' });
  } catch (err) {
    console.error('Error al eliminar post:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getPosts = async (req, res) => {
  try {
    const { category, author, dateFrom, dateTo, search } = req.query;
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

    const posts = await Post.find(query)
      .populate('author', 'username profileImage')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(20);
      
    res.json(posts);
  } catch (err) {
    console.error('Error al obtener posts:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username profileImage postCount replyCount xp')
      .populate('category', 'name')
      .populate('replies', 'content author likes createdAt')
      .populate('likes', 'username profileImage');
      
    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }
    
    res.json(post);
  } catch (err) {
    console.error('Error al obtener post por ID:', err);
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
          console.log(`Imagen antigua eliminada de Cloudinary: ${publicId}`);
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
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });

    const userId = req.user.userId;
    const index = post.likes.indexOf(userId);
    
    if (index === -1) {
      // Agregar like
      post.likes.push(userId);
      await addLikeXp(post.author);
    } else {
      // Quitar like
      post.likes.splice(index, 1);
      await removeLikeXp(post.author);
    }

    await post.save();
    
    // Obtener el post actualizado con todas las referencias
    const updatedPost = await Post.findById(req.params.id)
      .populate('author', 'username profileImage')
      .populate('category', 'name')
      .populate('replies', 'content author likes createdAt')
      .populate('likes', 'username profileImage');

    res.json(updatedPost);
  } catch (err) {
    console.error('Error al manejar like en post:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

module.exports = { 
  createPost, 
  getPosts, 
  getPostById, 
  updatePost, 
  deletePost,
  likePost,
  addPostXp
};