const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Reply = require('../models/Reply');
const Category = require('../models/Category');
const { sanitizeContent } = require('../utils/sanitize');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const slugify = require('slugify');

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
    console.log(`+10 XP a usuario por crear post (ID: ${userId})`);
  } catch (err) {
    console.error('Error al añadir XP por post:', err.message);
  }
};

// Función para añadir XP por recibir un like
const addLikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 2 } }, { runValidators: false });  // FIX: Atómico
    console.log(`+2 XP a usuario por recibir like (ID: ${userId})`);
  } catch (err) {
    console.error('Error al añadir XP por like:', err.message);
  }
};

// Función para quitar XP por quitar un like
const removeLikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: -1 } }, { runValidators: false });  // FIX: Atómico, clamp en schema
    console.log(`-1 XP a usuario por quitar like (ID: ${userId})`);
  } catch (err) {
    console.error('Error al quitar XP por like:', err.message);
  }
};

// Función para añadir XP por recibir un dislike
const addDislikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: -1 } }, { runValidators: false });  // FIX: Atómico
    console.log(`-1 XP a usuario por recibir dislike (ID: ${userId})`);
  } catch (err) {
    console.error('Error al añadir XP por dislike:', err.message);
  }
};

// Función para quitar XP por quitar un dislike
const removeDislikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 1 } }, { runValidators: false });  // FIX: Atómico
    console.log(`+1 XP a usuario por quitar dislike (ID: ${userId})`);
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

    console.log(`Post creado y counters actualizados para usuario ${req.user.userId}`);

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
    if (err.message && err.message.includes('Solo se permiten imágenes')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

// Nueva función para obtener post por slug
const getPostByParam = async (req, res) => {
  const param = req.params.param;
  console.log('Procesando ruta por param:', param); // Depuración

  try {
    let post;
    if (mongoose.Types.ObjectId.isValid(param)) {
      // Si es un ID válido, buscar por ID
      post = await Post.findById(param);
    } else {
      // Si no, buscar por slug
      post = await Post.findOne({ slug: param });
    }

    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    // Poblar todos los campos en una sola llamada a populate con un array
    await post.populate([
      { path: 'author', select: 'username profileImage postCount replyCount xp _id' },
      { path: 'category', select: 'name' },
      {
        path: 'replies',
        populate: [
          { path: 'author', select: 'username profileImage _id' },
          { path: 'likes', select: 'username' },
          { path: 'dislikes', select: 'username' },
          { path: 'parentReply', populate: { path: 'author', select: 'username profileImage _id' } }
        ],
        options: { sort: { createdAt: 1 } }
      },
      { path: 'likes', select: 'username profileImage' },
      { path: 'dislikes', select: 'username profileImage' }
    ]);

    // FIX: Verificar acceso a post VIP
    const authorized = req.user && (req.user.role === 'Admin' || req.user.role === 'GameMaster' || req.user.vip);
    if (post.category.name === 'VIP' && !authorized) {
      return res.status(403).json({ message: 'Acceso denegado a contenido VIP' });
    }

    res.json(post);
  } catch (err) {
    console.error('Error al obtener post por param:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
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
    
    // Disminuir contador de posts (FIX: Atomic $inc, clamp implícito por schema min:0)
    await User.updateOne(
      { _id: post.author },
      { $inc: { postCount: -1 } },  // Decrementa 1, no baja de 0 por schema
      { runValidators: true }
    );
    
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
      .populate('author', 'username profileImage _id')
      .populate('category', 'name')  // FIX: Asegurar populate de category para filtro
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
    console.log('Like request - User:', req.user ? { userId: req.user.userId, role: req.user.role, vip: req.user.vip } : 'undefined', 'Post ID:', req.params.id);

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
    console.log('Post saved after like, likes count:', post.likes.length);

    const updatedPost = await Post.findById(req.params.id)
      .populate('author', 'username profileImage')
      .populate('category', 'name')
      .populate('replies', 'content author likes dislikes createdAt')
      .populate('likes', 'username profileImage')
      .populate('dislikes', 'username profileImage');

    res.json(updatedPost);
  } catch (err) {
    console.error('Error al manejar like en post:', err.message);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};
const dislikePost = async (req, res) => {
  try {
    console.log('Dislike request - User:', req.user ? { userId: req.user.userId, role: req.user.role, vip: req.user.vip } : 'undefined', 'Post ID:', req.params.id);

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
      // Agregar dislike
      post.dislikes.push(userId);
      await addDislikeXp(post.author.toString());
      
      // Si tenía like, quitarlo
      if (likeIndex !== -1) {
        post.likes.splice(likeIndex, 1);
        await removeLikeXp(post.author.toString());
      }
    } else {
      // Quitar dislike
      post.dislikes.splice(dislikeIndex, 1);
      await removeDislikeXp(post.author.toString());
    }

    await post.save();
    
    console.log('Post saved after dislike, dislikes count:', post.dislikes.length);

    // Obtener el post actualizado con todas las referencias
    const updatedPost = await Post.findById(req.params.id)
      .populate('author', 'username profileImage')
      .populate('category', 'name')
      .populate('replies', 'content author likes dislikes createdAt')
      .populate('likes', 'username profileImage')
      .populate('dislikes', 'username profileImage');

    res.json(updatedPost);
  } catch (err) {
    console.error('Error al manejar dislike en post:', err.message);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};
const getPostsByCategory = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('getPostsByCategory - User:', req.user ? { userId: req.user.userId, role: req.user.role, vip: req.user.vip } : 'No user', 'Category ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de categoría inválido' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Verificar acceso para categorías VIP
    if (category.name.toUpperCase() === 'VIP' && !req.user) {
      console.log('Acceso denegado: usuario no autenticado');
      return res.status(401).json({ message: 'Autenticación requerida' });
    }

    const authorized = req.user && (req.user.vip || req.user.role === 'Admin' || req.user.role === 'GameMaster');
    if (category.name.toUpperCase() === 'VIP' && !authorized) {
      console.log('Acceso denegado a VIP category para user:', req.user?.userId || 'anonymous');
      return res.status(403).json({ message: 'Acceso denegado a categoría VIP' });
    }

    const posts = await Post.find({ category: id })
      .populate('author', 'username profileImage')
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    console.log(`Posts cargados para categoría ${id}: ${posts.length}`);
    res.json(posts);
  } catch (err) {
    console.error('Error al obtener posts por categoría:', err);
    res.status(500).json({ message: 'Error al obtener posts por categoría' });
  }
};



const getPostsCount = async (req, res) => {
  try {
    const count = await Post.countDocuments({});
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

module.exports = { 
  createPost, 
  getPosts, 
  updatePost, 
  deletePost,
  likePost,
  dislikePost,
  addPostXp,
  getPostsByCategory,
  getPostsCount,
  deletePostByAdmin,
  getPostByParam,
  removeDislikeXp
};