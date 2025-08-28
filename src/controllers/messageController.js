const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');

const sendRequest = async (req, res) => {
  try {
    const recipient = await User.findById(req.params.userId);
    if (!recipient) return res.status(404).json({ message: 'User not found' });
    await User.findByIdAndUpdate(recipient._id, { $push: { messageRequests: req.user.userId } });
    const notification = new Notification({ user: recipient._id, message: 'New message request', link: `/profile/${req.user.userId}` });
    await notification.save();
    req.io.to(recipient._id.toString()).emit('notification', notification);
    res.json({ message: 'Request sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const acceptRequest = async (req, res) => {
  try {
    const chatId = [req.user.userId, req.params.requestId].sort().join('-');
    await User.findByIdAndUpdate(req.user.userId, { $pull: { messageRequests: req.params.requestId }, $push: { contacts: req.params.requestId } });
    await User.findByIdAndUpdate(req.params.requestId, { $push: { contacts: req.user.userId } });
    res.json({ chatId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const message = new Message({ chatId: req.params.chatId, sender: req.user.userId, content });
    await message.save();
    // Emitir a ambos usuarios en el chat
    const [user1, user2] = req.params.chatId.split('-');
    req.io.to(user1).emit('message', message);
    req.io.to(user2).emit('message', message);
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const muteChat = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { $push: { mutedChats: req.params.chatId } });
    res.json({ message: 'Chat muted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { $push: { blockedUsers: req.params.userId } });
    res.json({ message: 'User blocked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { sendRequest, acceptRequest, sendMessage, getMessages, muteChat, blockUser };