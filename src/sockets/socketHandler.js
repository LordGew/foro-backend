const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const ModerationAction = require('../models/ModerationAction');
const Report = require('../models/Report');

class SocketHandler {
  constructor() {
    this.connectedUsers = new Map(); // userId -> socket.id
    this.userSockets = new Map(); // socket.id -> userId
    this.userRooms = new Map(); // userId -> Set of roomIds
  }

  initialize(io) {
    global.io = io;
    
    // Middleware de autenticación
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
          return next(new Error('User not found'));
        }
        
        if (user.isBanned) {
          return next(new Error('User is banned'));
        }
        
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
    
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.user.username} (${socket.user._id})`);
      
      // Registrar usuario conectado
      this.connectedUsers.set(socket.user._id.toString(), socket.id);
      this.userSockets.set(socket.id, socket.user._id.toString());
      this.userRooms.set(socket.user._id.toString(), new Set());
      
      // Unirse a rooms de chat del usuario
      this.joinUserChatRooms(socket);
      
      // Enviar estado de conexión a amigos
      this.broadcastUserStatus(socket.user._id, 'online');
      
      // Event handlers
      this.setupEventHandlers(socket);
      
      // Manejar desconexión
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  setupEventHandlers(socket) {
    const userId = socket.user._id.toString();
    
    // Unirse a un room de chat
    socket.on('join_chat', async (data) => {
      try {
        const { chatId } = data;
        
        // Verificar que el usuario tiene acceso al chat
        const chatRoom = await ChatRoom.findOne({
          _id: chatId,
          'participants.user': userId,
          isActive: true
        });
        
        if (!chatRoom) {
          socket.emit('error', { message: 'No tienes acceso a este chat' });
          return;
        }
        
        socket.join(`chat:${chatId}`);
        this.userRooms.get(userId).add(chatId);
        
        // Notificar a otros participantes
        socket.to(`chat:${chatId}`).emit('user_joined', {
          userId,
          username: socket.user.username,
          chatId
        });
        
        // Enviar estado actual del chat
        const unreadCount = await ChatMessage.countDocuments({
          chatRoom: chatId,
          sender: { $ne: userId },
          readAt: null,
          isDeleted: false
        });
        
        socket.emit('chat_status', {
          chatId,
          unreadCount,
          participants: chatRoom.participants.map(p => ({
            userId: p.user._id,
            username: p.user.username,
            isOnline: this.connectedUsers.has(p.user._id.toString())
          }))
        });
        
      } catch (error) {
        console.error('Error joining chat:', error);
        socket.emit('error', { message: 'Error al unirse al chat' });
      }
    });
    
    // Salir de un room de chat
    socket.on('leave_chat', (data) => {
      const { chatId } = data;
      socket.leave(`chat:${chatId}`);
      this.userRooms.get(userId).delete(chatId);
      
      socket.to(`chat:${chatId}`).emit('user_left', {
        userId,
        username: socket.user.username,
        chatId
      });
    });
    
    // Enviar mensaje en tiempo real
    socket.on('send_message', async (data) => {
      try {
        const { chatId, content, messageType = 'text' } = data;
        
        // Validaciones
        if (!content || content.trim().length === 0) {
          socket.emit('error', { message: 'El mensaje no puede estar vacío' });
          return;
        }
        
        if (content.length > 1000) {
          socket.emit('error', { message: 'El mensaje es demasiado largo' });
          return;
        }
        
        // Verificar acceso y permisos
        const chatRoom = await ChatRoom.findOne({
          _id: chatId,
          'participants.user': userId,
          isActive: true
        }).populate('participants.user');
        
        if (!chatRoom) {
          socket.emit('error', { message: 'No tienes acceso a este chat' });
          return;
        }
        
        // Verificar si está muteado
        const participant = chatRoom.participants.find(p => p.user._id.toString() === userId);
        if (participant.isMuted && participant.mutedUntil && participant.mutedUntil > new Date()) {
          socket.emit('error', { message: 'Estás muteado en este chat' });
          return;
        }
        
        // Verificar suspensiones activas
        const activeActions = await ModerationAction.getActiveActions(userId);
        const hasBan = activeActions.some(action => action.actionType === 'ban');
        const hasSuspension = activeActions.some(action => action.actionType === 'suspend');
        
        if (hasBan) {
          socket.emit('error', { message: 'Tu cuenta está baneada' });
          return;
        }
        
        if (hasSuspension) {
          socket.emit('error', { message: 'Tu cuenta está suspendida' });
          return;
        }
        
        // Crear mensaje
        const message = new ChatMessage({
          chatRoom: chatId,
          sender: userId,
          receiver: chatRoom.participants.find(p => p.user._id.toString() !== userId).user._id,
          content: content.trim(),
          messageType
        });
        
        await message.save();
        await message.populate('sender', 'username name avatar role');
        
        // Actualizar último mensaje del chat
        await ChatRoom.findByIdAndUpdate(chatId, {
          lastMessage: message._id,
          lastActivity: new Date()
        });
        
        // Emitir a todos los participantes del chat
        const messageData = {
          _id: message._id,
          chatRoom: chatId,
          sender: {
            _id: message.sender._id,
            username: message.sender.username,
            name: message.sender.name,
            avatar: message.sender.avatar,
            role: message.sender.role
          },
          content: message.content,
          messageType: message.messageType,
          createdAt: message.createdAt,
          isEdited: message.isEdited
        };
        
        // Enviar al room del chat
        io.to(`chat:${chatId}`).emit('new_message', messageData);
        
        // Enviar notificación a participantes no conectados
        chatRoom.participants.forEach(participant => {
          const participantId = participant.user._id.toString();
          if (participantId !== userId && !this.connectedUsers.has(participantId)) {
            io.emit(`user:${participantId}:notification`, {
              type: 'new_message',
              from: socket.user.username,
              chatId,
              message: content.substring(0, 100)
            });
          }
        });
        
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Error al enviar el mensaje' });
      }
    });
    
    // Escribiendo...
    socket.on('typing', (data) => {
      const { chatId } = data;
      socket.to(`chat:${chatId}`).emit('user_typing', {
        userId,
        username: socket.user.username,
        chatId
      });
    });
    
    // Dejar de escribir
    socket.on('stop_typing', (data) => {
      const { chatId } = data;
      socket.to(`chat:${chatId}`).emit('user_stop_typing', {
        userId,
        chatId
      });
    });
    
    // Marcar mensajes como leídos
    socket.on('mark_read', async (data) => {
      try {
        const { chatId } = data;
        
        await ChatRoom.findByIdAndUpdate(chatId, {
          $set: {
            'participants.$[elem].lastReadAt': new Date()
          }
        }, {
          arrayFilters: [{ 'elem.user': userId }]
        });
        
        await ChatMessage.updateMany(
          {
            chatRoom: chatId,
            receiver: userId,
            readAt: null
          },
          {
            readAt: new Date()
          }
        );
        
        socket.to(`chat:${chatId}`).emit('messages_read', {
          userId,
          chatId,
          readAt: new Date()
        });
        
      } catch (error) {
        console.error('Error marking read:', error);
      }
    });
    
    // Reportar mensaje en tiempo real
    socket.on('report_message', async (data) => {
      try {
        const { messageId, category, description } = data;
        
        const message = await ChatMessage.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Mensaje no encontrado' });
          return;
        }
        
        // Verificar si ya fue reportado
        const existingReport = await Report.findOne({
          reporter: userId,
          targetType: 'message',
          targetId: messageId,
          status: { $in: ['pending', 'under_review'] }
        });
        
        if (existingReport) {
          socket.emit('error', { message: 'Ya has reportado este mensaje' });
          return;
        }
        
        // Crear reporte
        const report = new Report({
          reporter: userId,
          targetType: 'message',
          targetId: messageId,
          category,
          description,
          priority: ['threats', 'violence'].includes(category) ? 'high' : 'medium'
        });
        
        await report.save();
        
        // Notificar a administradores
        const admins = await User.find({ role: { $in: ['admin', 'moderator'] } });
        admins.forEach(admin => {
          io.emit(`admin:${admin._id}:new_report`, {
            reportId: report._id,
            type: 'message',
            category,
            priority: report.priority,
            reporter: socket.user.username
          });
        });
        
        socket.emit('report_submitted', { reportId: report._id });
        
      } catch (error) {
        console.error('Error reporting message:', error);
        socket.emit('error', { message: 'Error al reportar el mensaje' });
      }
    });
    
    // Obtener usuarios en línea
    socket.on('get_online_users', async () => {
      try {
        const onlineUserIds = Array.from(this.connectedUsers.keys());
        const onlineUsers = await User.find({
          _id: { $in: onlineUserIds }
        }).select('username name avatar role status');
        
        socket.emit('online_users', onlineUsers);
      } catch (error) {
        console.error('Error getting online users:', error);
      }
    });
    
    // Eventos de administración
    if (['admin', 'moderator'].includes(socket.user.role)) {
      this.setupAdminEventHandlers(socket);
    }
  }

  setupAdminEventHandlers(socket) {
    const userId = socket.user._id.toString();
    
    // Unirse a sala de administradores
    socket.join('admin_room');
    
    // Obtener reportes pendientes
    socket.on('get_pending_reports', async () => {
      try {
        const pendingReports = await Report.find({ status: 'pending' })
          .populate('reporter', 'username name')
          .sort({ priority: -1, createdAt: -1 })
          .limit(10);
        
        socket.emit('pending_reports', pendingReports);
      } catch (error) {
        console.error('Error getting pending reports:', error);
      }
    });
    
    // Tomar reporte para revisión
    socket.on('take_report', async (data) => {
      try {
        const { reportId } = data;
        
        const report = await Report.findByIdAndUpdate(
          reportId,
          {
            status: 'under_review',
            reviewedBy: userId,
            reviewedAt: new Date()
          },
          { new: true }
        ).populate('reporter', 'username name');
        
        if (!report) {
          socket.emit('error', { message: 'Reporte no encontrado' });
          return;
        }
        
        // Notificar a otros admins
        socket.to('admin_room').emit('report_taken', {
          reportId,
          takenBy: socket.user.username
        });
        
        socket.emit('report_details', report);
        
      } catch (error) {
        console.error('Error taking report:', error);
        socket.emit('error', { message: 'Error al tomar el reporte' });
      }
    });
    
    // Aplicar acción de moderación en tiempo real
    socket.on('apply_moderation', async (data) => {
      try {
        const { targetUserId, action, duration, reason } = data;
        
        // Crear acción de moderación
        const moderationAction = new ModerationAction({
          targetUser: targetUserId,
          moderator: userId,
          actionType: action,
          duration,
          reason
        });
        
        await moderationAction.save();
        
        // Aplicar acción al usuario
        if (action === 'ban') {
          await User.findByIdAndUpdate(targetUserId, { isBanned: true });
          
          // Desconectar usuario si está en línea
          const userSocketId = this.connectedUsers.get(targetUserId.toString());
          if (userSocketId) {
            io.sockets.sockets.get(userSocketId)?.disconnect();
          }
        } else if (action === 'suspend') {
          const suspendedUntil = duration ? 
            new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;
          await User.findByIdAndUpdate(targetUserId, { 
            isSuspended: true,
            suspendedUntil 
          });
        }
        
        // Notificar al usuario afectado
        io.emit(`user:${targetUserId}:moderation_action`, {
          action,
          duration,
          reason,
          moderatedBy: socket.user.username
        });
        
        // Notificar a otros admins
        socket.to('admin_room').emit('moderation_applied', {
          targetUserId,
          action,
          appliedBy: socket.user.username
        });
        
        socket.emit('moderation_success', { targetUserId, action });
        
      } catch (error) {
        console.error('Error applying moderation:', error);
        socket.emit('error', { message: 'Error al aplicar moderación' });
      }
    });
  }

  async joinUserChatRooms(socket) {
    try {
      const userId = socket.user._id;
      const userChats = await ChatRoom.find({
        'participants.user': userId,
        isActive: true
      });
      
      userChats.forEach(chat => {
        socket.join(`chat:${chat._id}`);
        this.userRooms.get(userId.toString()).add(chat._id.toString());
      });
      
    } catch (error) {
      console.error('Error joining user chat rooms:', error);
    }
  }

  handleDisconnect(socket) {
    const userId = socket.user._id.toString();
    
    console.log(`User disconnected: ${socket.user.username} (${userId})`);
    
    // Limpiar registros
    this.connectedUsers.delete(userId);
    this.userSockets.delete(socket.id);
    this.userRooms.delete(userId);
    
    // Notificar estado offline
    this.broadcastUserStatus(socket.user._id, 'offline');
    
    // Salir de todos los rooms de chat
    const userRooms = Array.from(this.userRooms.get(userId) || []);
    userRooms.forEach(chatId => {
      socket.to(`chat:${chatId}`).emit('user_left', {
        userId,
        username: socket.user.username,
        chatId
      });
    });
  }

  broadcastUserStatus(userId, status) {
    if (global.io) {
      global.io.emit('user_status_changed', {
        userId,
        status,
        timestamp: new Date()
      });
    }
  }

  // Método para enviar notificación a usuario específico
  sendNotificationToUser(userId, notification) {
    const socketId = this.connectedUsers.get(userId.toString());
    if (socketId && global.io) {
      global.io.to(socketId).emit('notification', notification);
    }
  }

  // Método para enviar mensaje a room de chat
  sendToChatRoom(chatId, event, data) {
    if (global.io) {
      global.io.to(`chat:${chatId}`).emit(event, data);
    }
  }

  // Método para enviar a administradores
  sendToAdmins(event, data) {
    if (global.io) {
      global.io.to('admin_room').emit(event, data);
    }
  }

  // Obtener estadísticas en tiempo real
  getRealTimeStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeChats: this.userRooms.size,
      totalConnections: this.userSockets.size
    };
  }
}

module.exports = new SocketHandler();
