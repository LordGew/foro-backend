const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

// Obtener todas las conversaciones del usuario
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({
      participants: userId
    })
      .populate('participants', 'username avatar profileImage')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username avatar' }
      })
      .sort({ lastMessageAt: -1 });

    // Calcular mensajes no leídos por conversación
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          'readBy.user': { $ne: userId }
        });

        // Determinar estado de la conversación para este usuario
        let status = 'active';
        if (conv.blockedBy && conv.blockedBy.some(id => id.toString() === userId)) {
          status = 'blocked';
        } else if (conv.mutedBy && conv.mutedBy.some(id => id.toString() === userId)) {
          status = 'muted';
        }

        return {
          _id: conv._id,
          participants: conv.participants.filter(p => p._id.toString() !== userId),
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
          status
        };
      })
    );

    res.json(conversationsWithUnread);
  } catch (error) {
    console.error('Error en getConversations:', error);
    res.status(500).json({ message: 'Error al obtener conversaciones', error: error.message });
  }
};

// Obtener o crear conversación con un usuario
exports.getOrCreateConversation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otherUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ message: 'ID de usuario inválido' });
    }

    // Verificar que el otro usuario existe
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Buscar conversación existente
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, otherUserId], $size: 2 }
    })
      .populate('participants', 'username avatar profileImage')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username avatar' }
      });

    // Si no existe, crear nueva
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userId, otherUserId]
      });
      
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'username avatar profileImage');
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error en getOrCreateConversation:', error);
    res.status(500).json({ message: 'Error al obtener conversación', error: error.message });
  }
};

// Obtener mensajes de una conversación
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'ID de conversación inválido' });
    }

    // Verificar que el usuario es parte de la conversación
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    // Construir query
    const query = {
      conversation: conversationId,
      deleted: false
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Obtener mensajes
    const messages = await Message.find(query)
      .populate('sender', 'username avatar profileImage')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(messages.reverse());
  } catch (error) {
    console.error('Error en getMessages:', error);
    res.status(500).json({ message: 'Error al obtener mensajes', error: error.message });
  }
};

// Enviar mensaje
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const { content, type = 'text' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'El contenido del mensaje es requerido' });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'ID de conversación inválido' });
    }

    // Verificar que el usuario es parte de la conversación
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    // Crear mensaje
    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content: content.trim(),
      type
    });

    // Actualizar conversación
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageAt: new Date()
    });

    // Poblar datos del mensaje
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username avatar profileImage');

    // Emitir evento Socket.IO a la sala de la conversación
    if (req.io) {
      // Emitir a la sala de la conversación
      req.io.to(`conversation:${conversationId}`).emit('newMessage', {
        conversationId,
        message: populatedMessage
      });
      
      // También emitir a cada participante individualmente para actualizar la lista
      conversation.participants.forEach(participantId => {
        if (participantId.toString() !== userId) {
          req.io.to(participantId.toString()).emit('newMessage', {
            conversationId,
            message: populatedMessage
          });
        }
      });
      
      console.log('📤 Mensaje emitido vía Socket.IO:', conversationId);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error en sendMessage:', error);
    res.status(500).json({ message: 'Error al enviar mensaje', error: error.message });
  }
};

// Marcar mensajes como leídos
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'ID de conversación inválido' });
    }

    // Verificar que el usuario es parte de la conversación
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    // Marcar mensajes no leídos como leídos
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date()
          }
        }
      }
    );

    // Emitir evento Socket.IO
    if (req.io) {
      const otherParticipant = conversation.participants.find(
        p => p.toString() !== userId
      );
      
      req.io.to(otherParticipant.toString()).emit('messagesRead', {
        conversationId,
        readBy: userId
      });
    }

    res.json({ message: 'Mensajes marcados como leídos' });
  } catch (error) {
    console.error('Error en markAsRead:', error);
    res.status(500).json({ message: 'Error al marcar mensajes', error: error.message });
  }
};

// Eliminar mensaje
exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: 'ID de mensaje inválido' });
    }

    const message = await Message.findOne({
      _id: messageId,
      sender: userId
    });

    if (!message) {
      return res.status(404).json({ message: 'Mensaje no encontrado' });
    }

    message.deleted = true;
    message.content = 'Este mensaje fue eliminado';
    await message.save();

    // Emitir evento Socket.IO
    if (req.io) {
      const conversation = await Conversation.findById(message.conversation);
      const otherParticipant = conversation.participants.find(
        p => p.toString() !== userId
      );
      
      req.io.to(otherParticipant.toString()).emit('messageDeleted', {
        conversationId: message.conversation,
        messageId
      });
    }

    res.json({ message: 'Mensaje eliminado' });
  } catch (error) {
    console.error('Error en deleteMessage:', error);
    res.status(500).json({ message: 'Error al eliminar mensaje', error: error.message });
  }
};

// Obtener usuarios online
exports.getOnlineUsers = async (req, res) => {
  try {
    const io = req.io;
    if (!io) {
      return res.status(500).json({ message: 'Socket.IO no disponible' });
    }

    const sockets = await io.fetchSockets();
    const onlineUserIds = [...new Set(sockets.map(s => s.userId).filter(Boolean))];

    res.json({ onlineUsers: onlineUserIds });
  } catch (error) {
    console.error('Error en getOnlineUsers:', error);
    res.status(500).json({ message: 'Error al obtener usuarios online', error: error.message });
  }
};
