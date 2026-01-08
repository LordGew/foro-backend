const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');

// Middleware para autenticación en todas las rutas
router.use(authMiddleware);

// Rutas de chat
router.get('/chats', chatController.getUserChats);
router.get('/chats/stats', chatController.getChatStats);
router.post('/chats/private/:userId', chatController.getOrCreatePrivateChat);
router.get('/chats/:chatId/messages', chatController.getChatMessages);
router.post('/chats/:chatId/messages', chatController.sendMessage);
router.post('/chats/:chatId/upload', chatController.uploadChatFile);
router.put('/messages/:messageId', chatController.editMessage);
router.delete('/messages/:messageId', chatController.deleteMessage);
router.post('/messages/:messageId/report', chatController.reportMessage);
router.post('/chats/:chatId/read', chatController.markAsRead);

// Rutas de moderación
router.post('/chats/:chatId/mute/:userId', chatController.muteUser);
router.post('/chats/:chatId/unmute/:userId', chatController.unmuteUser);
router.post('/chats/:chatId/ban/:userId', chatController.banUser);
router.post('/chats/:chatId/unban/:userId', chatController.unbanUser);

// Servir archivos estáticos de chat
router.use('/uploads/chat', express.static(path.join(__dirname, '../uploads/chat')));

module.exports = router;
