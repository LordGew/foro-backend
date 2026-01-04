const express = require('express');
const router = express.Router();
const {
  sendRequest,
  acceptRequest,
  rejectRequest,
  getRequests,
  sendMessage,
  getMessages,
  muteChat,
  unmuteChat,  // Agregado para consistencia
  blockUser,
  reportChat,
  getChats,
  markAsRead,
  addReaction,
  deleteMessage,
  editMessage,
  unblockUser
} = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');
// REMOVIDO: csrfProtection = require('csurf'); // Para mutantes

// ===== RUTAS DE LECTURA (GET) - Primero =====
router.get('/', authMiddleware, getChats);  // Lista de chats
router.get('/requests', authMiddleware, getRequests);  // Solicitudes pendientes
router.get('/chat/:chatId', authMiddleware, getMessages);  // Mensajes de chat

// ===== RUTAS DE CREACIÓN (POST) =====
router.post('/request/:targetId', authMiddleware, sendRequest);  // REMOVIDO: csrfProtection
router.post('/requests/:id/accept', authMiddleware, acceptRequest);  // REMOVIDO: csrfProtection
router.post('/requests/:id/reject', authMiddleware, rejectRequest);  // REMOVIDO: csrfProtection
router.post('/chat/:chatId', authMiddleware, sendMessage);  // REMOVIDO: csrfProtection
router.post('/reaction/:messageId', authMiddleware, addReaction);  // REMOVIDO: csrfProtection
router.post('/chat/:chatId/report', authMiddleware, reportChat);  // REMOVIDO: csrfProtection

// ===== RUTAS DE ACTUALIZACIÓN (PUT) =====
router.put('/chat/:chatId/mute', authMiddleware, muteChat);  // REMOVIDO: csrfProtection
router.put('/chat/:chatId/unmute', authMiddleware, unmuteChat);  // REMOVIDO: csrfProtection
router.put('/user/:userId/block', authMiddleware, blockUser);  // REMOVIDO: csrfProtection
router.put('/user/:userId/unblock', authMiddleware, unblockUser);  // REMOVIDO: csrfProtection
router.put('/chat/:chatId/read', authMiddleware, markAsRead);  // REMOVIDO: csrfProtection
router.put('/chat/:chatId/:messageId', authMiddleware, editMessage);  // REMOVIDO: csrfProtection

// ===== RUTAS DE ELIMINACIÓN (DELETE) =====
router.delete('/chat/:chatId/:messageId', authMiddleware, deleteMessage);  // REMOVIDO: csrfProtection

module.exports = router;