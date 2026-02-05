const mongoose = require('mongoose');
const Reply = require('../models/Reply');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sanitizeContent } = require('../utils/sanitize');
const { likePost, dislikePost } = require('./postController');
const { checkAndGrantAchievements } = require('../utils/achievementChecker');


// Función para añadir XP por crear una respuesta (línea ~18)
const addReplyXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { 
      $inc: { xp: 5, replyCount: 1 }  // Asume +5 XP y +1 replyCount; ajusta si diferente
    }, { runValidators: false });  // FIX: Atómico, sin validación full
    console.log(`+5 XP y +1 replyCount a usuario por respuesta (ID: ${userId})`);
  } catch (err) {
    console.error('Error al añadir XP por respuesta:', err.message);
  }
};

// Función para añadir XP por like en respuesta (línea ~34, para toggleLike)
const addLikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 2 } }, { runValidators: false });  // FIX: Atómico
    console.log(`+2 XP a usuario por like en respuesta (ID: ${userId})`);
  } catch (err) {
    console.error('Error al añadir XP por like en respuesta:', err.message);
  }
};

// Función para quitar XP por quitar like en respuesta
const removeLikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: -1 } }, { runValidators: false });  // FIX: Atómico
    console.log(`-1 XP a usuario por quitar like en respuesta (ID: ${userId})`);
  } catch (err) {
    console.error('Error al quitar XP por like en respuesta:', err.message);
  }
};

// Función para añadir XP por dislike en respuesta (línea ~66, para toggleDislike)
const addDislikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: -1 } }, { runValidators: false });  // FIX: Atómico
    console.log(`-1 XP a usuario por dislike en respuesta (ID: ${userId})`);
  } catch (err) {
    console.error('Error al añadir XP por dislike en respuesta:', err.message);
  }
};

// Función para quitar XP por quitar dislike en respuesta
const removeDislikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 1 } }, { runValidators: false });  // FIX: Atómico
    console.log(`+1 XP a usuario por quitar dislike en respuesta (ID: ${userId})`);
  } catch (err) {
    console.error('Error al quitar XP por dislike en respuesta:', err.message);
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

    // Upload images to Cloudinary if present
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const cloudinary = require('cloudinary').v2;
      for (const file of req.files) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'image', folder: 'replies' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(file.buffer);
        });
        imageUrls.push(result.secure_url);
      }
    }

    const reply = new Reply({ 
      content: sanitizedContent, 
      post: req.params.postId, 
      author: req.user.userId,
      parentReply,
      quote: sanitizedQuote,
      images: imageUrls
    });
    
    await reply.save();
    
    await Post.findByIdAndUpdate(req.params.postId, { $push: { replies: reply._id } });
    
    // FIX: Update atómico para replyCount y XP (combina con addReplyXp, sin validación full)
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { replyCount: 1, xp: 5 },  // Asume +5 XP por reply; ajusta si diferente
      lastLogin: new Date()
    }, { runValidators: false });
    
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
      .populate([
        {
          path: 'author',
          select: 'username profileImage replyCount _id role vip activeRewards',
          transform: (doc) => {
            if (doc && doc.profileImage && !doc.profileImage.startsWith('http')) {
              doc.profileImage = `https://res.cloudinary.com/duqywugjo/image/upload/v1759376255/profiles/${doc.profileImage}`;
            }
            return doc;
          }
        },
        { path: 'likes', select: 'username profileImage' },
        { path: 'dislikes', select: 'username profileImage' },
        {
          path: 'parentReply',
          populate: [
            { path: 'author', select: 'username profileImage _id role vip' }
          ]
        }
      ]);

    // Verificar logros generales (replies, XP, etc.)
    await checkAndGrantAchievements(req.user.userId, 'reply_created');

    // Actualizar progreso de misiones diarias
    const missionController = require('./missionController');
    await missionController.updateMissionProgress(req.user.userId, 'create_reply', 1);
    await missionController.updateMissionProgress(req.user.userId, 'earn_xp', 5);

    res.status(201).json(populatedReply);
  } catch (err) {
    console.error('Error al crear respuesta:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};



const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: 'ID de la respuesta no proporcionado' });
    }
    
    const reply = await Reply.findById(id);
    if (!reply) return res.status(404).json({ message: 'Respuesta no encontrada' });

    // FIX: Check para author válido
    if (!reply.author || !mongoose.Types.ObjectId.isValid(reply.author)) {
      return res.status(400).json({ message: 'Respuesta sin autor válido' });
    }

    const userId = req.user.userId;
    const likeIndex = reply.likes.findIndex(like => like.toString() === userId);
    const dislikeIndex = reply.dislikes.findIndex(dislike => dislike.toString() === userId);
    
    if (likeIndex === -1) {
      // Agregar like
      reply.likes.push(userId);
      // FIX: Update atómico para XP (combina addLikeXp/removeDislikeXp)
      await User.findByIdAndUpdate(reply.author, { $inc: { xp: 2 } }, { runValidators: false });
      
      // Si tenía dislike, quitarlo y ajustar XP
      if (dislikeIndex !== -1) {
        reply.dislikes.splice(dislikeIndex, 1);
        await User.findByIdAndUpdate(reply.author, { $inc: { xp: 1 } }, { runValidators: false });  // +1 por quitar dislike
      }
    } else {
      // Quitar like
      reply.likes.splice(likeIndex, 1);
      // FIX: Update atómico para XP (combina removeLikeXp)
      await User.findByIdAndUpdate(reply.author, { $inc: { xp: -1 } }, { runValidators: false });
    }

    await reply.save();
    
    const updatedReply = await Reply.findById(id)
      .populate([
        {
          path: 'author',
          select: 'username profileImage replyCount _id role vip activeRewards',
          transform: (doc) => {
            if (doc && doc.profileImage && !doc.profileImage.startsWith('http')) {
              doc.profileImage = `https://res.cloudinary.com/duqywugjo/image/upload/v1759376255/profiles/${doc.profileImage}`;
            }
            return doc;
          }
        },
        { path: 'likes', select: 'username profileImage' },
        { path: 'dislikes', select: 'username profileImage' },
        {
          path: 'parentReply',
          populate: [
            { path: 'author', select: 'username profileImage _id role vip' }
          ]
        }
      ]);

    res.json(updatedReply);
  } catch (err) {
    console.error('Error al manejar like:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const toggleDislike = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: 'ID de la respuesta no proporcionado' });
    }
    
    const reply = await Reply.findById(id);
    if (!reply) return res.status(404).json({ message: 'Respuesta no encontrada' });

    // FIX: Check para author válido
    if (!reply.author || !mongoose.Types.ObjectId.isValid(reply.author)) {
      return res.status(400).json({ message: 'Respuesta sin autor válido' });
    }

    const userId = req.user.userId;
    const likeIndex = reply.likes.findIndex(like => like.toString() === userId);
    const dislikeIndex = reply.dislikes.findIndex(dislike => dislike.toString() === userId);
    
    if (dislikeIndex === -1) {
      // Agregar dislike
      reply.dislikes.push(userId);
      // FIX: Update atómico para XP (combina addDislikeXp/removeLikeXp)
      await User.findByIdAndUpdate(reply.author, { $inc: { xp: -1 } }, { runValidators: false });
      
      // Si tenía like, quitarlo y ajustar XP
      if (likeIndex !== -1) {
        reply.likes.splice(likeIndex, 1);
        await User.findByIdAndUpdate(reply.author, { $inc: { xp: 1 } }, { runValidators: false });  // +1 por quitar like
      }
    } else {
      // Quitar dislike
      reply.dislikes.splice(dislikeIndex, 1);
      // FIX: Update atómico para XP (combina removeDislikeXp)
      await User.findByIdAndUpdate(reply.author, { $inc: { xp: 1 } }, { runValidators: false });
    }

    await reply.save();
    
    const updatedReply = await Reply.findById(id)
      .populate([
        {
          path: 'author',
          select: 'username profileImage replyCount _id role vip activeRewards',
          transform: (doc) => {
            if (doc && doc.profileImage && !doc.profileImage.startsWith('http')) {
              doc.profileImage = `https://res.cloudinary.com/duqywugjo/image/upload/v1759376255/profiles/${doc.profileImage}`;
            }
            return doc;
          }
        },
        { path: 'likes', select: 'username profileImage' },
        { path: 'dislikes', select: 'username profileImage' },
        {
          path: 'parentReply',
          populate: [
            { path: 'author', select: 'username profileImage _id role vip' }
          ]
        }
      ]);

    res.json(updatedReply);
  } catch (err) {
    console.error('Error al manejar dislike:', err);
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
      .populate([
        {
          path: 'author',
          select: 'username profileImage replyCount _id role vip activeRewards',
          transform: (doc) => {
            if (doc && doc.profileImage && !doc.profileImage.startsWith('http')) {
              doc.profileImage = `https://res.cloudinary.com/duqywugjo/image/upload/v1759376255/profiles/${doc.profileImage}`;
            }
            return doc;
          }
        },
        { path: 'likes', select: 'username profileImage' },
        { path: 'dislikes', select: 'username profileImage' },
        {
          path: 'parentReply',
          populate: [
            { path: 'author', select: 'username profileImage _id role vip' }
          ]
        }
      ])
      .sort({ createdAt: -1 });
      
    res.json(replies);
  } catch (err) {
    console.error('Error al obtener respuestas:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const getAllReplies = async (req, res) => {
  try {
    // Para el panel de moderación, devolver todos los comentarios sin paginación
    const replies = await Reply.find({})
      .populate('author', 'username profileImage replyCount role vip')
      .populate('post', 'title')
      .populate('likes', 'username profileImage')
      .populate('dislikes', 'username profileImage')
      .populate('parentReply', 'content author')
      .sort({ createdAt: -1 })
      .lean();

    // Formatear las respuestas para el frontend
    const formattedReplies = replies.map(reply => ({
      _id: reply._id,
      content: reply.content,
      author: reply.author ? {
        _id: reply.author._id,
        username: reply.author.username,
        profileImage: reply.author.profileImage 
          ? `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/profiles/${reply.author.profileImage}`
          : null
      } : null,
      post: reply.post ? {
        _id: reply.post._id,
        title: reply.post.title
      } : null,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt
    }));

    res.json(formattedReplies);
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
      .populate('author', 'username profileImage replyCount role vip')
      .populate('likes', 'username profileImage')
      .populate('dislikes', 'username profileImage')
      .populate('parentReply', 'content author');
      
    res.json(updatedReply);
  } catch (err) {
    console.error('Error al actualizar respuesta:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

// Añade esta función a tu replyController.js
const deleteReplyByAdmin = async (req, res) => {
  try {
    const reply = await Reply.findById(req.params.id);
    
    if (!reply) {
      return res.status(404).json({ message: 'Comentario no encontrado' });
    }

    // Eliminar el comentario
    await Reply.findByIdAndDelete(req.params.id);
    
    // Actualizar contador de comentarios del usuario
    await User.findByIdAndUpdate(reply.author, { 
      $inc: { replyCount: -1 } 
    });

    // Actualizar contador de comentarios del post
    await Post.findByIdAndUpdate(reply.post, { 
      $inc: { replyCount: -1 } 
    });

    res.json({ message: 'Comentario eliminado por administrador' });
  } catch (err) {
    console.error('Error al eliminar comentario (admin):', err);
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
  toggleLike,
  toggleDislike,
  deleteReplyByAdmin,
  removeDislikeXp,
  addDislikeXp,
  addLikeXp,
  addReplyXp,
  likePost,
  dislikePost
  
};
