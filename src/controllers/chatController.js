const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const Report = require('../models/Report');
const ModerationAction = require('../models/ModerationAction');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/chat');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

class ChatController {
  // Obtener chats del usuario
  async getUserChats(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const chats = await ChatRoom.getUserChats(req.user._id, page, limit);
      
      // Para cada chat, obtener no leídos
      const chatsWithUnread = await Promise.all(chats.map(async (chat) => {
        const unreadCount = await ChatMessage.countDocuments({
          chatRoom: chat._id,
          sender: { $ne: req.user._id },
          readAt: null,
          isDeleted: false
        });
        
        return {
          ...chat.toObject(),
          unreadCount
        };
      }));
      
      res.json({
        success: true,
        data: chatsWithUnread,
        pagination: {
          page,
          limit,
          total: chatsWithUnread.length
        }
      });
    } catch (error) {
      console.error('Error getting user chats:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los chats'
      });
    }
  }

  // Crear o obtener chat privado
  async getOrCreatePrivateChat(req, res) {
    try {
      const { userId } = req.params;
      
      if (userId === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'No puedes crear un chat contigo mismo'
        });
      }
      
      // Verificar que el otro usuario existe
      const otherUser = await User.findById(userId);
      if (!otherUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Buscar chat privado existente
      let chatRoom = await ChatRoom.findPrivateChat(req.user._id, userId);
      
      if (!chatRoom) {
        // Crear nuevo chat privado
        chatRoom = new ChatRoom({
          type: 'private',
          participants: [
            { user: req.user._id },
            { user: userId }
          ],
          createdBy: req.user._id
        });
        
        await chatRoom.save();
        await chatRoom.populate('participants.user', 'username name avatar role');
      }
      
      res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      console.error('Error getting/creating private chat:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear/obtener el chat'
      });
    }
  }

  // Obtener mensajes de un chat
  async getChatMessages(req, res) {
    try {
      const { chatId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      
      // Verificar que el usuario es participante del chat
      const chatRoom = await ChatRoom.findOne({
        _id: chatId,
        'participants.user': req.user._id,
        isActive: true
      });
      
      if (!chatRoom) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este chat'
        });
      }
      
      const messages = await ChatMessage.find({
        chatRoom: chatId,
        isDeleted: false
      })
      .populate('sender', 'username name avatar role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
      
      // Marcar mensajes como leídos
      await chatRoom.markAsRead(req.user._id);
      
      res.json({
        success: true,
        data: messages.reverse(),
        pagination: {
          page,
          limit
        }
      });
    } catch (error) {
      console.error('Error getting chat messages:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los mensajes'
      });
    }
  }

  // Enviar mensaje
  async sendMessage(req, res) {
    try {
      const { chatId } = req.params;
      const { content, messageType = 'text' } = req.body;
      
      // Validar contenido
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El mensaje no puede estar vacío'
        });
      }
      
      if (content.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'El mensaje no puede exceder 1000 caracteres'
        });
      }
      
      // Verificar acceso al chat
      const chatRoom = await ChatRoom.findOne({
        _id: chatId,
        'participants.user': req.user._id,
        isActive: true
      }).populate('participants.user');
      
      if (!chatRoom) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este chat'
        });
      }
      
      // Verificar si el usuario está muteado
      const participant = chatRoom.participants.find(p => p.user._id.toString() === req.user._id.toString());
      if (participant.isMuted && participant.mutedUntil && participant.mutedUntil > new Date()) {
        return res.status(403).json({
          success: false,
          message: 'Estás muteado en este chat'
        });
      }
      
      // Verificar si el usuario tiene suspensiones activas
      const activeActions = await ModerationAction.getActiveActions(req.user._id);
      const hasBan = activeActions.some(action => action.actionType === 'ban');
      const hasSuspension = activeActions.some(action => action.actionType === 'suspend');
      
      if (hasBan) {
        return res.status(403).json({
          success: false,
          message: 'Tu cuenta está baneada'
        });
      }
      
      if (hasSuspension) {
        return res.status(403).json({
          success: false,
          message: 'Tu cuenta está suspendida'
        });
      }
      
      // Crear mensaje
      const message = new ChatMessage({
        chatRoom: chatId,
        sender: req.user._id,
        receiver: chatRoom.participants.find(p => p.user._id.toString() !== req.user._id.toString()).user._id,
        content: content.trim(),
        messageType
      });
      
      await message.save();
      await message.populate('sender', 'username name avatar role');
      
      // Emitir mensaje vía Socket.IO
      if (global.io) {
        // Enviar a todos los participantes del chat
        chatRoom.participants.forEach(participant => {
          global.io.emit(`user:${participant.user._id}:new_message`, {
            message,
            chatRoom: {
              _id: chatRoom._id,
              type: chatRoom.type,
              participants: chatRoom.participants.map(p => ({
                user: {
                  _id: p.user._id,
                  username: p.user.username,
                  name: p.user.name,
                  avatar: p.user.avatar
                }
              }))
            }
          });
        });
      }
      
      res.status(201).json({
        success: true,
        data: message
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        message: 'Error al enviar el mensaje'
      });
    }
  }

  // Subir archivo en chat
  uploadChatFile(req, res) {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'Error al subir el archivo: ' + err.message
        });
      }
      
      try {
        const { chatId } = req.params;
        const file = req.file;
        
        if (!file) {
          return res.status(400).json({
            success: false,
            message: 'No se proporcionó ningún archivo'
          });
        }
        
        // Verificar acceso al chat
        const chatRoom = await ChatRoom.findOne({
          _id: chatId,
          'participants.user': req.user._id,
          isActive: true
        });
        
        if (!chatRoom) {
          // Eliminar archivo si no tiene acceso
          fs.unlinkSync(file.path);
          return res.status(403).json({
            success: false,
            message: 'No tienes acceso a este chat'
          });
        }
        
        // Crear mensaje de archivo
        const message = new ChatMessage({
          chatRoom: chatId,
          sender: req.user._id,
          receiver: chatRoom.participants.find(p => p.user._id.toString() !== req.user._id.toString()).user._id,
          content: `📎 ${file.originalname}`,
          messageType: file.mimetype.startsWith('image/') ? 'image' : 'file',
          fileUrl: `/uploads/chat/${file.filename}`
        });
        
        await message.save();
        await message.populate('sender', 'username name avatar role');
        
        // Emitir mensaje vía Socket.IO
        if (global.io) {
          chatRoom.participants.forEach(participant => {
            global.io.emit(`user:${participant.user._id}:new_message`, {
              message,
              chatRoom: {
                _id: chatRoom._id,
                type: chatRoom.type
              }
            });
          });
        }
        
        res.status(201).json({
          success: true,
          data: message
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        // Eliminar archivo si hay error
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
          success: false,
          message: 'Error al subir el archivo'
        });
      }
    });
  }

  // Editar mensaje
  async editMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El mensaje no puede estar vacío'
        });
      }
      
      const message = await ChatMessage.findById(messageId);
      
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }
      
      if (message.sender.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes editar tus propios mensajes'
        });
      }
      
      if (message.isDeleted) {
        return res.status(400).json({
          success: false,
          message: 'No puedes editar un mensaje eliminado'
        });
      }
      
      // Solo se puede editar dentro de los 15 minutos
      const editTimeLimit = 15 * 60 * 1000; // 15 minutos
      if (Date.now() - message.createdAt.getTime() > editTimeLimit) {
        return res.status(400).json({
          success: false,
          message: 'Solo puedes editar mensajes dentro de los 15 minutos posteriores'
        });
      }
      
      message.content = content.trim();
      message.isEdited = true;
      message.editedAt = new Date();
      
      await message.save();
      
      // Emitir actualización vía Socket.IO
      if (global.io) {
        global.io.emit(`chat:${message.chatRoom}:message_updated`, {
          messageId: message._id,
          content: message.content,
          isEdited: message.isEdited,
          editedAt: message.editedAt
        });
      }
      
      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      console.error('Error editing message:', error);
      res.status(500).json({
        success: false,
        message: 'Error al editar el mensaje'
      });
    }
  }

  // Eliminar mensaje
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      
      const message = await ChatMessage.findById(messageId);
      
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }
      
      // Verificar permisos (propietario del mensaje o admin)
      const canDelete = message.sender.toString() === req.user._id.toString() || 
                       ['admin', 'moderator'].includes(req.user.role);
      
      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para eliminar este mensaje'
        });
      }
      
      message.isDeleted = true;
      message.deletedAt = new Date();
      
      if (req.user.role !== 'user') {
        message.moderatedBy = req.user._id;
        message.moderatedAt = new Date();
        message.moderationReason = 'Eliminado por moderador';
      }
      
      await message.save();
      
      // Emitir eliminación vía Socket.IO
      if (global.io) {
        global.io.emit(`chat:${message.chatRoom}:message_deleted`, {
          messageId: message._id
        });
      }
      
      res.json({
        success: true,
        message: 'Mensaje eliminado correctamente'
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar el mensaje'
      });
    }
  }

  // Reportar mensaje
  async reportMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { category, description } = req.body;
      
      if (!category || !description) {
        return res.status(400).json({
          success: false,
          message: 'La categoría y descripción son requeridas'
        });
      }
      
      const message = await ChatMessage.findById(messageId).populate('sender');
      
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }
      
      // Verificar que no haya reportado ya este mensaje
      const existingReport = await Report.findOne({
        reporter: req.user._id,
        targetType: 'message',
        targetId: messageId,
        status: { $in: ['pending', 'under_review'] }
      });
      
      if (existingReport) {
        return res.status(400).json({
          success: false,
          message: 'Ya has reportado este mensaje'
        });
      }
      
      // Crear reporte
      const report = new Report({
        reporter: req.user._id,
        targetType: 'message',
        targetId: messageId,
        category,
        description,
        priority: category === 'threats' || category === 'violence' ? 'high' : 'medium'
      });
      
      await report.save();
      
      // Incrementar contador de reportes del mensaje
      message.reportedCount += 1;
      
      // Si hay muchos reportes, ocultar el mensaje temporalmente
      if (message.reportedCount >= 3) {
        message.isHidden = true;
      }
      
      await message.save();
      
      res.status(201).json({
        success: true,
        message: 'Mensaje reportado correctamente',
        data: report
      });
    } catch (error) {
      console.error('Error reporting message:', error);
      res.status(500).json({
        success: false,
        message: 'Error al reportar el mensaje'
      });
    }
  }

  // Marcar mensajes como leídos
  async markAsRead(req, res) {
    try {
      const { chatId } = req.params;
      
      const chatRoom = await ChatRoom.findOne({
        _id: chatId,
        'participants.user': req.user._id,
        isActive: true
      });
      
      if (!chatRoom) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este chat'
        });
      }
      
      await chatRoom.markAsRead(req.user._id);
      
      // Marcar mensajes individuales como leídos
      await ChatMessage.updateMany(
        {
          chatRoom: chatId,
          receiver: req.user._id,
          readAt: null
        },
        {
          readAt: new Date()
        }
      );
      
      // Emitir estado de lectura vía Socket.IO
      if (global.io) {
        global.io.emit(`chat:${chatId}:read`, {
          userId: req.user._id,
          readAt: new Date()
        });
      }
      
      res.json({
        success: true,
        message: 'Mensajes marcados como leídos'
      });
    } catch (error) {
      console.error('Error marking as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar mensajes como leídos'
      });
    }
  }

  // Obtener estadísticas del chat
  async getChatStats(req, res) {
    try {
      const userId = req.user._id;
      
      const stats = await ChatRoom.aggregate([
        { $match: { 'participants.user': userId, isActive: true } },
        {
          $lookup: {
            from: 'chatmessages',
            localField: '_id',
            foreignField: 'chatRoom',
            as: 'messages'
          }
        },
        {
          $group: {
            _id: null,
            totalChats: { $sum: 1 },
            totalMessages: { $sum: { $size: '$messages' } },
            unreadMessages: {
              $sum: {
                $size: {
                  $filter: {
                    input: '$messages',
                    cond: {
                      $and: [
                        { $ne: ['$$this.sender', userId] },
                        { $eq: ['$$this.readAt', null] },
                        { $eq: ['$$this.isDeleted', false] }
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      ]);
      
      res.json({
        success: true,
        data: stats[0] || {
          totalChats: 0,
          totalMessages: 0,
          unreadMessages: 0
        }
      });
    } catch (error) {
      console.error('Error getting chat stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas'
      });
    }
  }

  // Silenciar usuario en un chat
  async muteUser(req, res) {
    try {
      const { chatId, userId } = req.params;
      const { duration } = req.body; // duración en minutos
      
      // Verificar permisos (admin o moderador)
      if (!['Admin', 'GameMaster'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para silenciar usuarios'
        });
      }
      
      const chatRoom = await ChatRoom.findById(chatId);
      
      if (!chatRoom) {
        return res.status(404).json({
          success: false,
          message: 'Chat no encontrado'
        });
      }
      
      // Calcular duración del mute (por defecto 30 minutos)
      const muteDuration = duration ? duration * 60 * 1000 : 30 * 60 * 1000;
      
      await chatRoom.muteParticipant(userId, muteDuration);
      
      // Crear acción de moderación
      const moderationAction = new ModerationAction({
        actionType: 'mute',
        targetUser: userId,
        moderator: req.user._id,
        reason: 'Silenciado en chat',
        chatRoom: chatId,
        duration: muteDuration,
        expiresAt: new Date(Date.now() + muteDuration)
      });
      
      await moderationAction.save();
      
      // Emitir evento vía Socket.IO
      if (global.io) {
        global.io.emit(`user:${userId}:muted`, {
          chatId,
          mutedUntil: new Date(Date.now() + muteDuration),
          moderator: req.user.username
        });
      }
      
      res.json({
        success: true,
        message: 'Usuario silenciado correctamente',
        data: {
          mutedUntil: new Date(Date.now() + muteDuration)
        }
      });
    } catch (error) {
      console.error('Error muting user:', error);
      res.status(500).json({
        success: false,
        message: 'Error al silenciar usuario'
      });
    }
  }

  // Quitar silencio a usuario
  async unmuteUser(req, res) {
    try {
      const { chatId, userId } = req.params;
      
      // Verificar permisos
      if (!['Admin', 'GameMaster'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para quitar silencio'
        });
      }
      
      const chatRoom = await ChatRoom.findById(chatId);
      
      if (!chatRoom) {
        return res.status(404).json({
          success: false,
          message: 'Chat no encontrado'
        });
      }
      
      await chatRoom.unmuteParticipant(userId);
      
      // Emitir evento vía Socket.IO
      if (global.io) {
        global.io.emit(`user:${userId}:unmuted`, {
          chatId,
          moderator: req.user.username
        });
      }
      
      res.json({
        success: true,
        message: 'Silencio removido correctamente'
      });
    } catch (error) {
      console.error('Error unmuting user:', error);
      res.status(500).json({
        success: false,
        message: 'Error al quitar silencio'
      });
    }
  }

  // Banear usuario de un chat
  async banUser(req, res) {
    try {
      const { chatId, userId } = req.params;
      const { reason, duration } = req.body; // duración en horas
      
      // Verificar permisos
      if (!['Admin', 'GameMaster'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para banear usuarios'
        });
      }
      
      const chatRoom = await ChatRoom.findById(chatId);
      
      if (!chatRoom) {
        return res.status(404).json({
          success: false,
          message: 'Chat no encontrado'
        });
      }
      
      // Remover usuario del chat
      await chatRoom.removeParticipant(userId);
      
      // Calcular duración del ban (por defecto 24 horas)
      const banDuration = duration ? duration * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      
      // Crear acción de moderación
      const moderationAction = new ModerationAction({
        actionType: 'ban',
        targetUser: userId,
        moderator: req.user._id,
        reason: reason || 'Baneado del chat',
        chatRoom: chatId,
        duration: banDuration,
        expiresAt: new Date(Date.now() + banDuration)
      });
      
      await moderationAction.save();
      
      // Emitir evento vía Socket.IO
      if (global.io) {
        global.io.emit(`user:${userId}:banned`, {
          chatId,
          reason: reason || 'Baneado del chat',
          bannedUntil: new Date(Date.now() + banDuration),
          moderator: req.user.username
        });
      }
      
      res.json({
        success: true,
        message: 'Usuario baneado correctamente',
        data: {
          bannedUntil: new Date(Date.now() + banDuration)
        }
      });
    } catch (error) {
      console.error('Error banning user:', error);
      res.status(500).json({
        success: false,
        message: 'Error al banear usuario'
      });
    }
  }

  // Quitar ban a usuario
  async unbanUser(req, res) {
    try {
      const { chatId, userId } = req.params;
      
      // Verificar permisos
      if (!['Admin', 'GameMaster'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para quitar bans'
        });
      }
      
      // Eliminar acciones de moderación activas
      await ModerationAction.updateMany(
        {
          targetUser: userId,
          chatRoom: chatId,
          actionType: 'ban',
          isActive: true
        },
        {
          isActive: false,
          resolvedAt: new Date(),
          resolvedBy: req.user._id
        }
      );
      
      // Emitir evento vía Socket.IO
      if (global.io) {
        global.io.emit(`user:${userId}:unbanned`, {
          chatId,
          moderator: req.user.username
        });
      }
      
      res.json({
        success: true,
        message: 'Ban removido correctamente'
      });
    } catch (error) {
      console.error('Error unbanning user:', error);
      res.status(500).json({
        success: false,
        message: 'Error al quitar ban'
      });
    }
  }
}

module.exports = new ChatController();
