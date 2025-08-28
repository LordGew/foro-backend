// src/controllers/replyController.js
const Reply = require('../models/Reply');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sanitizeContent } = require('../utils/sanitize');

// Función para añadir XP por crear respuesta
const addReplyXp = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    user.xp = (user.xp || 0) + 5; // Ejemplo: +5 XP por respuesta
    await user.save();
    
    console.log(`+5 XP a usuario ${user.username} por crear respuesta`);
    return user;
  } catch (err) {
    console.error('Error al añadir XP por respuesta:', err);
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

const createReply = async (req, res) => {
  try {
    // Validar que req.body exista
    if (!req.body) {
      return res.status(400).json({ 
        message: 'No se recibió el cuerpo de la solicitud'
      });
    }
    
    // Validar que el contenido no esté vacío
    if (!req.body.content || !req.body.content.trim()) {
      return res.status(400).json({ 
        message: 'El contenido de la respuesta no puede estar vacío'
      });
    }
    
    const { content, parentReply, quote } = req.body;
    const sanitizedContent = sanitizeContent(content.trim());
    const sanitizedQuote = quote ? sanitizeContent(quote.trim()) : null;

    if (parentReply) {
      const parent = await Reply.findById(parentReply);
      if (!parent) {
        return res.status(404).json({ message: 'Respuesta padre no encontrada' });
      }
      if (parent.post.toString() !== req.params.postId) {
        return res.status(400).json({ message: 'La respuesta padre no pertenece a este post' });
      }
    }

    const reply = new Reply({ 
      content: sanitizedContent, 
      post: req.params.postId, 
      author: req.user.userId,
      parentReply,
      quote: sanitizedQuote
    });
    
    await reply.save();
    
    // Actualizar el post con la nueva respuesta
    await Post.findByIdAndUpdate(req.params.postId, { $push: { replies: reply._id } });
    
    // Aumentar contador de respuestas
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { replyCount: 1 },
      lastLogin: new Date()
    });
    
    // Añadir XP al usuario por responder
    await addReplyXp(req.user.userId);
    
    // Notificar al autor del post
    const post = await Post.findById(req.params.postId);
    if (post && post.author.toString() !== req.user.userId) {
      const notification = new Notification({
        user: post.author,
        message: `${req.user.username} respondió a tu post`,
        link: `/post/${post._id}`
      });
      await notification.save();
      
      // Emitir notificación en tiempo real si tienes Socket.IO
      if (req.io) {
        req.io.to(post.author.toString()).emit('notification', notification);
      }
    }
    
    // Obtener la respuesta con todas las referencias
    const populatedReply = await Reply.findById(reply._id)
      .populate('author', 'username profileImage replyCount')
      .populate('likes', 'username profileImage')
      .populate('parentReply', 'content author');
      
    res.status(201).json(populatedReply);
  } catch (err) {
    console.error('Error al crear respuesta:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const deleteReply = async (req, res) => {
  try {
    const reply = await Reply.findById(req.params.id);
    if (!reply) return res.status(404).json({ message: 'Respuesta no encontrada' });
    
    // Verificar que el usuario sea el autor o un administrador
    if (reply.author.toString() !== req.user.userId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    // Disminuir contador de respuestas
    await User.findByIdAndUpdate(reply.author, {
      $inc: { replyCount: -1 },
      lastLogin: new Date()
    });
    
    // Eliminar la respuesta del post
    await Post.findByIdAndUpdate(reply.post, { $pull: { replies: reply._id } });
    
    await reply.deleteOne();
    
    res.json({ message: 'Respuesta eliminada' });
  } catch (err) {
    console.error('Error al eliminar respuesta:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getReplies = async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Validar que el postId sea válido
    if (!postId) {
      return res.status(400).json({ 
        message: 'ID del post no proporcionado' 
      });
    }
    
    const replies = await Reply.find({ post: postId })
      .populate('author', 'username profileImage replyCount')
      .populate('likes', 'username profileImage')
      .populate('parentReply', 'content author')
      .sort({ createdAt: -1 });
      
    res.json(replies);
  } catch (err) {
    console.error('Error al obtener respuestas:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getAllReplies = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const replies = await Reply.find({})
      .populate('author', 'username profileImage replyCount')
      .populate('post', 'title')
      .populate('likes', 'username profileImage')
      .populate('parentReply', 'content author')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await Reply.countDocuments();
    
    res.json({
      replies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        hasNext: skip + replies.length < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Error al obtener todas las respuestas:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const updateReply = async (req, res) => {
  try {
    // Validar que req.body exista
    if (!req.body) {
      return res.status(400).json({ 
        message: 'No se recibió el cuerpo de la solicitud'
      });
    }
    
    // Validar que el contenido no esté vacío
    if (!req.body.content || !req.body.content.trim()) {
      return res.status(400).json({ 
        message: 'El contenido de la respuesta no puede estar vacío'
      });
    }
    
    const { content } = req.body;
    const sanitizedContent = sanitizeContent(content.trim());
    
    const reply = await Reply.findById(req.params.id);
    if (!reply) {
      return res.status(404).json({ message: 'Respuesta no encontrada' });
    }
    
    // Verificar que el usuario sea el autor
    if (reply.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    reply.content = sanitizedContent;
    await reply.save();
    
    // Obtener la respuesta actualizada con todas las referencias
    const updatedReply = await Reply.findById(req.params.id)
      .populate('author', 'username profileImage replyCount')
      .populate('likes', 'username profileImage')
      .populate('parentReply', 'content author');
      
    res.json(updatedReply);
  } catch (err) {
    console.error('Error al actualizar respuesta:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

// NUEVO: Toggle like en una respuesta
const toggleLike = async (req, res) => {
  try {
    const { replyId } = req.params;
    
    // Validar que el replyId sea válido
    if (!replyId) {
      return res.status(400).json({ 
        message: 'ID de la respuesta no proporcionado' 
      });
    }
    
    const reply = await Reply.findById(replyId);
    if (!reply) return res.status(404).json({ message: 'Respuesta no encontrada' });

    // Verificar que el usuario no pueda dar like a su propia respuesta
    if (reply.author.toString() === req.user.userId) {
      return res.status(400).json({ 
        message: 'No puedes dar like a tu propia respuesta' 
      });
    }

    // Verificar si el usuario ya le dio like
    const userId = req.user.userId;
    const index = reply.likes.indexOf(userId);
    
    if (index === -1) {
      // Agregar like
      reply.likes.push(userId);
      await addLikeXp(reply.author);
    } else {
      // Quitar like
      reply.likes.splice(index, 1);
      await removeLikeXp(reply.author);
    }

    await reply.save();
    
    // Obtener la respuesta actualizada con todas las referencias
    const updatedReply = await Reply.findById(replyId)
      .populate('author', 'username profileImage replyCount')
      .populate('likes', 'username profileImage')
      .populate('parentReply', 'content author');

    res.json(updatedReply);
  } catch (err) {
    console.error('Error al manejar like:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

module.exports = { 
  createReply, 
  getReplies,
  getAllReplies, 
  updateReply, 
  deleteReply,
  toggleLike
};