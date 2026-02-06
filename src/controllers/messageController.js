const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

// Delete Message
const deleteMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.user.userId;

    // Validar formato del chatId
    const [user1, user2] = chatId.split('-');
    if (!user1 || !user2 || ![user1, user2].includes(userId) || !mongoose.Types.ObjectId.isValid(user1) || !mongoose.Types.ObjectId.isValid(user2)) {
      return res.status(400).json({ message: 'Formato de chatId inválido o usuario no autorizado' });
    }

    // Buscar el mensaje
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Mensaje no encontrado' });
    }

    // Verificar que el usuario sea el remitente
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: 'No estás autorizado para eliminar este mensaje' });
    }

    // Eliminar el mensaje
    await Message.findByIdAndDelete(messageId);

    // Emitir evento por Socket.IO
    if (req.io) {
      req.io.to(chatId).emit('messageDeleted', messageId);
    }

    res.json({ message: 'Mensaje eliminado correctamente' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ message: 'Error al eliminar mensaje', error: err.message });
  }
};

// Edit Message
const editMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    // Validar parámetros
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'El contenido del mensaje es requerido' });
    }

    // Validar formato del chatId
    const [user1, user2] = chatId.split('-');
    if (!user1 || !user2 || ![user1, user2].includes(userId) || !mongoose.Types.ObjectId.isValid(user1) || !mongoose.Types.ObjectId.isValid(user2)) {
      return res.status(400).json({ message: 'Formato de chatId inválido o usuario no autorizado' });
    }

    // Buscar el mensaje
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Mensaje no encontrado' });
    }

    // Verificar que el usuario sea el remitente
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: 'No estás autorizado para editar este mensaje' });
    }

    // Actualizar el mensaje
    message.content = content.trim();
    message.editedAt = new Date(); // Agregar marca de tiempo para indicar que fue editado
    await message.save();

    // Poblar el campo sender para devolver datos completos
    const updatedMessage = await Message.findById(messageId).populate('sender', 'username avatar profileImage profilePicture');

    // Emitir evento por Socket.IO
    if (req.io) {
      req.io.to(chatId).emit('messageEdited', {
        messageId,
        content: updatedMessage.content,
        editedAt: updatedMessage.editedAt,
        sender: updatedMessage.sender
      });
    }

    res.json(updatedMessage);
  } catch (err) {
    console.error('Error editing message:', err);
    res.status(500).json({ message: 'Error al editar mensaje', error: err.message });
  }
};

// Get Requests (solicitudes pendientes, populated)
const getRequests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).populate('messageRequests', 'username profileImage avatar profilePicture status');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user.messageRequests || []);
  } catch (error) {
    console.error('Error en getRequests:', error);
    res.status(500).json({ message: 'Error interno', error: error.message });
  }
};

// Send Message
const sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;
    const senderId = req.user.userId;

    if (!chatId || !content) {
      return res.status(400).json({ message: 'chatId y content son requeridos' });
    }

    const message = new Message({
      chatId,
      sender: senderId,
      content: content.trim()
    });
    await message.save();

    // Emitir socket
    if (req.io) {
      req.io.to(chatId).emit('message', { 
        msg: {
          id: message._id,
          chatId,
          content: message.content,
          from: { _id: senderId },
          createdAt: message.createdAt
        }
      });
    }

    res.json(message);
  } catch (error) {
    console.error('Error en sendMessage:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Get Messages
const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chatId })
      .populate('sender', 'username _id') // Poblar el campo sender
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    console.error('Error en getMessages:', err);
    res.status(500).json({ message: err.message });
  }
};

// Mute Chat (fix: usa User.mutedChats array de strings, no modelo Chat)
const muteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Validar chatId
    const [user1, user2] = chatId.split('-');
    if (!user1 || !user2 || ![user1, user2].includes(userId) || !mongoose.Types.ObjectId.isValid(user1) || !mongoose.Types.ObjectId.isValid(user2)) {
      return res.status(400).json({ message: 'Formato de chatId inválido o usuario no autorizado' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Agregar chatId a mutedChats si no existe
    if (!user.mutedChats.includes(chatId)) {
      user.mutedChats.push(chatId);
      await user.save();
    }

    // Emitir socket
    if (req.io) {
      req.io.to(chatId).emit('chatMuted', { chatId, userId });
    }

    res.json({ message: 'Chat silenciado exitosamente' });
  } catch (error) {
    console.error('Error en muteChat:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Unmute Chat (nuevo, complementario)
// Unmute Chat
const unmuteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Validar chatId
    const [user1, user2] = chatId.split('-');
    if (!user1 || !user2 || ![user1, user2].includes(userId) || !mongoose.Types.ObjectId.isValid(user1) || !mongoose.Types.ObjectId.isValid(user2)) {
      return res.status(400).json({ message: 'Formato de chatId inválido o usuario no autorizado' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Eliminar chatId de mutedChats si existe
    const muteIndex = user.mutedChats.indexOf(chatId);
    if (muteIndex !== -1) {
      user.mutedChats.splice(muteIndex, 1);
      await user.save();
    }

    // Emitir socket
    if (req.io) {
      req.io.to(chatId).emit('chatUnmuted', { chatId, userId });
    }

    res.json({ message: 'Chat des-silenciado exitosamente' });
  } catch (error) {
    console.error('Error en unmuteChat:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Block User
const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const blockerId = req.user.userId;

    // Validar IDs
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(blockerId)) {
      return res.status(400).json({ message: 'IDs inválidos' });
    }

    const blocker = await User.findById(blockerId);
    if (!blocker) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Agregar a blockedUsers si no existe
    if (!blocker.blockedUsers.some(bId => bId.toString() === userId)) {
      blocker.blockedUsers.push(userId);
      await blocker.save();
    }

    // Opcional: Agregar a blockedBy del bloqueado
    await User.findByIdAndUpdate(userId, {
      $addToSet: { blockedBy: blockerId }
    }, { new: true });

    // Emitir socket
    if (req.io) {
      req.io.to(userId).emit('userBlocked', { blockerId, message: 'Has sido bloqueado' });
    }

    res.json({ message: 'Usuario bloqueado exitosamente' });
  } catch (err) {
    console.error('Error en blockUser:', err);
    res.status(500).json({ message: err.message });
  }
};

// Report Chat
const reportChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const reporterId = req.user.userId;
    const { reason = 'inappropriate' } = req.body;

    // Validar chatId
    const [user1, user2] = chatId.split('-');
    if (!user1 || !user2 || ![user1, user2].includes(reporterId) || !mongoose.Types.ObjectId.isValid(user1) || !mongoose.Types.ObjectId.isValid(user2)) {
      return res.status(400).json({ message: 'Invalid chatId format' });
    }

    // Almacenar el reporte en el usuario que reporta
    await User.findByIdAndUpdate(reporterId, {
      $push: {
        reportedChats: {
          chatId,
          reason,
          reportedAt: new Date()
        }
      }
    });

    // Notificar al otro usuario
    const otherUserId = user1 === reporterId ? user2 : user1;
    const notification = new Notification({
      user: otherUserId,
      message: `${req.user.username} ha reportado el chat por: ${reason}`,
      link: `/messages/${chatId}`
    });
    await notification.save();
    if (req.io) {
      req.io.to(otherUserId).emit('notification', notification);
    }

    res.json({ message: 'Chat reported successfully' });
  } catch (err) {
    console.error('Error en reportChat:', err);
    res.status(500).json({ message: err.message });
  }
};

// Mark As Read
const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Validar chatId
    const [user1, user2] = chatId.split('-');
    if (!user1 || !user2 || ![user1, user2].includes(userId) || !mongoose.Types.ObjectId.isValid(user1) || !mongoose.Types.ObjectId.isValid(user2)) {
      return res.status(400).json({ error: 'Invalid chatId format' });
    }

    // Actualizar mensajes no leídos
    const result = await Message.updateMany(
      { chatId, isRead: false, sender: { $ne: userId } },
      { $set: { isRead: true }, $currentDate: { lastReadAt: true } }
    );

    if (result.modifiedCount === 0 && result.matchedCount === 0) {
      return res.status(200).json({ success: true, message: 'No unread messages to mark' });
    }

    // Emitir evento Socket.IO
    if (req.io) {
      req.io.to(chatId).emit('messagesRead', { chatId, userId });
    }

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Add Reaction
const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reaction, action } = req.body;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (!message.reactions[reaction]) message.reactions[reaction] = [];

    if (action === 'add') {
      if (!message.reactions[reaction].includes(userId)) message.reactions[reaction].push(userId);
    } else if (action === 'remove') {
      message.reactions[reaction] = message.reactions[reaction].filter(id => id !== userId);
    }

    await message.save();

    if (req.io) {
      req.io.to(message.chatId).emit('reaction', { messageId, reaction, userId, action });
    }

    res.json(message.reactions);
  } catch (err) {
    console.error('Error en addReaction:', err);
    res.status(500).json({ message: err.message });
  }
};

// Get Chats (de contacts)
const getChats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).populate('contacts', 'username profileImage avatar profilePicture status lastSeen');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Generar chats desde contacts
    const chats = user.contacts.map(contact => {
      const ids = [userId, contact._id].map(id => id.toString()).sort();
      const chatId = `${ids[0]}-${ids[1]}`;
      return {
        id: chatId,
        user: {
          _id: contact._id,
          username: contact.username,
          profileImage: contact.profileImage,
          avatar: contact.avatar,
          profilePicture: contact.profilePicture,
          status: contact.status || 'active',
          lastSeen: contact.lastSeen
        },
        status: user.mutedChats.includes(chatId) ? 'muted' : 'active',
        unreadCount: 0,
        lastSnippet: '',
        lastMessageAt: new Date()
      };
    });

    res.json(chats);
  } catch (error) {
    console.error('Error en getChats:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Send Request
const sendRequest = async (req, res) => {
  try {
    const { targetId } = req.params;
    const senderId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(targetId) || !mongoose.Types.ObjectId.isValid(senderId)) {
      return res.status(400).json({ message: 'IDs de usuario inválidos' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario objetivo no encontrado' });
    }

    if (targetUser.contacts.some(cId => cId.toString() === senderId)) {
      return res.status(400).json({ message: 'Ya eres contacto de este usuario' });
    }
    if (targetUser.messageRequests.some(rId => rId.toString() === senderId)) {
      return res.status(400).json({ message: 'Ya enviaste una solicitud' });
    }

    targetUser.messageRequests.push(senderId);
    await targetUser.save();

    if (req.io) {
      req.io.to(targetId.toString()).emit('newRequest', {
        from: senderId,
        message: 'Nueva solicitud de chat de ' + (req.user.username || 'un usuario')
      });
    }

    res.json({ message: 'Solicitud enviada exitosamente' });
  } catch (error) {
    console.error('Error en sendRequest:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Accept Request
const acceptRequest = async (req, res) => {
  try {
    const requesterId = req.params.id;
    const receiverId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(requesterId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: 'IDs de usuario inválidos' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Usuario receptor no encontrado' });
    }

    const requesterIndex = receiver.messageRequests.findIndex(rId => rId.toString() === requesterId);
    if (requesterIndex === -1) {
      return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada' });
    }

    const requester = await User.findById(requesterId);
    if (!requester) {
      return res.status(404).json({ message: 'Usuario solicitante no encontrado' });
    }

    const ids = [requesterId, receiverId].map(id => id.toString()).sort();
    const chatId = `${ids[0]}-${ids[1]}`;
    receiver.messageRequests.splice(requesterIndex, 1);
    receiver.contacts.push(requesterId);
    await receiver.save();

    if (!requester.contacts.some(cId => cId.toString() === receiverId)) {
      requester.contacts.push(receiverId);
      await requester.save();
    }

    if (req.io) {
      req.io.to(requesterId.toString()).emit('requestAccepted', {
        chatId,
        message: 'Tu solicitud de chat ha sido aceptada. ¡Puedes chatear ahora!'
      });
      req.io.to(receiverId.toString()).emit('chatCreated', { 
        chatId, 
        user: { _id: requesterId, username: requester.username } 
      });
    }

    const chatResponse = {
      id: chatId,
      chatId: chatId,
      users: [requesterId.toString(), receiverId.toString()],
      status: 'active',
      lastMessageAt: new Date(),
      unreadCount: 0,
      lastSnippet: ''
    };

    res.status(200).json(chatResponse);
  } catch (error) {
    console.error('Error en acceptRequest:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Reject Request
const rejectRequest = async (req, res) => {
  try {
    const requesterId = req.params.id;
    const receiverId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(requesterId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: 'IDs de usuario inválidos' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Usuario receptor no encontrado' });
    }

    const requesterIndex = receiver.messageRequests.findIndex(rId => rId.toString() === requesterId);
    if (requesterIndex === -1) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    receiver.messageRequests.splice(requesterIndex, 1);
    await receiver.save();

    if (req.io) {
      req.io.to(requesterId.toString()).emit('requestRejected', { 
        message: 'Tu solicitud de chat ha sido rechazada' 
      });
    }

    res.json({ message: 'Solicitud rechazada exitosamente' });
  } catch (error) {
    console.error('Error en rejectRequest:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const unblockerId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(unblockerId)) {
      return res.status(400).json({ message: 'IDs inválidos' });
    }

    const unblocker = await User.findById(unblockerId);
    if (!unblocker) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Eliminar de blockedUsers
    unblocker.blockedUsers = unblocker.blockedUsers.filter(bId => bId.toString() !== userId);
    unblocker.status = 'active';  // Fix: Resetea status
    await unblocker.save();

    // Eliminar de blockedBy del bloqueado
    await User.findByIdAndUpdate(userId, {
      $pull: { blockedBy: unblockerId }
    });

    // Emitir socket
    if (req.io) {
      req.io.to(userId).emit('userUnblocked', { unblockerId, message: 'Has sido desbloqueado' });
    }

    res.json({ message: 'Usuario desbloqueado exitosamente' });
  } catch (err) {
    console.error('Error en unblockUser:', err);
    res.status(500).json({ message: err.message });
  }
};


// Delete Chat (eliminar todos los mensajes de un chat para el usuario)
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Validar formato del chatId
    const [user1, user2] = chatId.split('-');
    if (!user1 || !user2 || ![user1, user2].includes(userId)) {
      return res.status(400).json({ message: 'Formato de chatId inválido o usuario no autorizado' });
    }

    // Eliminar todos los mensajes del chat
    await Message.deleteMany({ chatId });

    res.json({ message: 'Chat eliminado correctamente' });
  } catch (err) {
    console.error('Error deleting chat:', err);
    res.status(500).json({ message: 'Error al eliminar chat', error: err.message });
  }
};

// Get Blocked Users
const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).populate('blockedUsers', '_id username name avatar profileImage');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json({ blockedUsers: user.blockedUsers || [] });
  } catch (err) {
    console.error('Error en getBlockedUsers:', err);
    res.status(500).json({ message: err.message });
  }
};

// Exports (todas las funciones definidas arriba)
module.exports = {
  deleteMessage,
  editMessage,
  getRequests,
  sendMessage,
  getMessages,
  muteChat,
  unmuteChat,
  blockUser,
  reportChat,
  getChats,
  markAsRead,
  addReaction,
  sendRequest,
  acceptRequest,
  rejectRequest,
  unblockUser,
  getBlockedUsers,
  deleteChat
};