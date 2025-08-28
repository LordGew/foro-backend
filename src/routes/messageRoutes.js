const express = require('express');
const router = express.Router();
const { sendRequest, acceptRequest, sendMessage, getMessages, muteChat, blockUser } = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/request/:userId', authMiddleware, sendRequest);
router.put('/request/:requestId/accept', authMiddleware, acceptRequest);
router.post('/:chatId', authMiddleware, sendMessage);
router.get('/:chatId', authMiddleware, getMessages);
router.put('/:chatId/mute', authMiddleware, muteChat);
router.put('/:userId/block', authMiddleware, blockUser);

module.exports = router;