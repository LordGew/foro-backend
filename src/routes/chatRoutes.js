const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const chatController = require('../controllers/chatController');

// Obtener todas las conversaciones del usuario
router.get('/conversations', authMiddleware, chatController.getConversations);

// Obtener o crear conversación con un usuario
router.get('/conversations/:otherUserId', authMiddleware, chatController.getOrCreateConversation);

// Obtener mensajes de una conversación
router.get('/conversations/:conversationId/messages', authMiddleware, chatController.getMessages);

// Enviar mensaje
router.post('/conversations/:conversationId/messages', authMiddleware, chatController.sendMessage);

// Marcar mensajes como leídos
router.put('/conversations/:conversationId/read', authMiddleware, chatController.markAsRead);

// Eliminar mensaje
router.delete('/messages/:messageId', authMiddleware, chatController.deleteMessage);

// Obtener usuarios online
router.get('/online-users', authMiddleware, chatController.getOnlineUsers);

module.exports = router;
