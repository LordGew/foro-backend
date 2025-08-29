const Reply = require('../models/Reply');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sanitizeContent } = require('../utils/sanitize');

const addReplyXp = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    user.xp = (user.xp || 0) + 5;
    await user.save();
    
    console.log(`+5 XP a usuario ${user.username} por crear respuesta`);
    return user;
  } catch (err) {
    console.error('Error al añadir XP por respuesta:', err);
    throw err;
  }
};

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
    if (!req.body) {
      return res.status(400).json({ message: 'No se recibió el cuerpo de la solicitud' });
    }
    
    if (!req.body.content || !req.body.content.trim()) {
      return res.status(400).json({ message: 'El contenido de la respuesta no puede estar vacío' });
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
    
    await Post.findByIdAndUpdate(req.params.postId, { $push: { replies: reply._id } });
    
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { replyCount: 1 },
      lastLogin: new Date()
    });
    
    await addReplyXp(req.user.userId);
    
    const post = await Post.findById(req.params.postId);
    if (post && post.author.toString() !== req.user.userId) {
      const notification = new Notification({
        user: post.author,
        message: `${req.user.username} respondió a tu post`,
        link: `/post/${post._id}`
      });
      await notification.save();
      
      if (req.io) {
        req.io.to(post.author.toString()).emit('notification', notification);
      }
    }
    
    const populatedReply = await Reply.findById(reply._id)
      .populate('author', 'username profileImage replyCount')
      .populate('likes', 'username profileImage')
      .populate('parentReply', 'content author');
      
    res.status(201).json(populatedReply);
  } catch (err) {
    console.error('Error al crear respuesta:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const deleteReply = async (req, res) => {
  try {
    const reply = await Reply.findById(req.params.id);
    if (!reply) return res.status(404).json({ message: 'Respuesta no encontrada' });
    
    if (reply.author.toString() !== req.user.userId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    await User.findByIdAndUpdate(reply.author, {
      $inc: { replyCount: -1 },
      lastLogin: new Date()
    });
    
    await Post.findByIdAndUpdate(reply.post, { $pull: { replies: reply._id } });
    
    await reply.deleteOne();
    
    res.json({ message: 'Respuesta eliminada' });
  } catch (err) {
    console.error('Error al eliminar respuesta:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const getReplies = async (req, res) => {
  try {
    const { postId } = req.params;
    
    if (!postId) {
      return res.status(400).json({ message: 'ID del post no proporcionado' });
    }
    
    const replies = await Reply.find({ post: postId })
      .populate('author', 'username profileImage replyCount')
      .populate('likes', 'username profileImage')
      .populate('parentReply', 'content author')
      .sort({ createdAt: -1 });
      
    res.json(replies);
  } catch (err) {
    console.error('Error al obtener respuestas:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
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
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const updateReply = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: 'No se recibió el cuerpo de la solicitud' });
    }
    
    if (!req.body.content || !req.body.content.trim()) {
      return res.status(400).json({ message: 'El contenido de la respuesta no puede estar vacío' });
    }
    
    const { content } = req.body;
    const sanitizedContent = sanitizeContent(content.trim());
    
    const reply = await Reply.findById(req.params.id);
    if (!reply) {
      return res.status(404).json({ message: 'Respuesta no encontrada' });
    }
    
    if (reply.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    reply.content = sanitizedContent;
    await reply.save();
    
    const updatedReply = await Reply.findById(req.params.id)
      .populate('author', 'username profileImage replyCount')
      .populate('likes', 'username profileImage')
      .populate('parentReply', 'content author');
      
    res.json(updatedReply);
  } catch (err) {
    console.error('Error al actualizar respuesta:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const { replyId } = req.params;
    
    if (!replyId) {
      return res.status(400).json({ message: 'ID de la respuesta no proporcionado' });
    }
    
    const reply = await Reply.findById(replyId);
    if (!reply) return res.status(404).json({ message: 'Respuesta no encontrada' });

    const userId = req.user.userId;
    const index = reply.likes.findIndex(like => like.toString() === userId);
    
    if (index === -1) {
      reply.likes.push(userId);
      await addLikeXp(reply.author);
    } else {
      reply.likes.splice(index, 1);
      await removeLikeXp(reply.author);
    }

    await reply.save();
    
    const updatedReply = await Reply.findById(replyId)
      .populate('author', 'username profileImage replyCount')
      .populate('likes', 'username profileImage')
      .populate('parentReply', 'content author');

    res.json(updatedReply);
  } catch (err) {
    console.error('Error al manejar like:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
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