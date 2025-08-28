// src/controllers/adminController.js
const AdminSettings = require('../models/AdminSettings');
const User = require('../models/User');

const updateForumSettings = async (req, res) => {
  try {
    const { forumName, language, theme } = req.body;
    const settings = await AdminSettings.findOneAndUpdate({}, { forumName, language, theme }, { upsert: true, new: true });
    // Aplicar instantly: pero como es backend, frontend refresca
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getForumSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.findOne() || { forumName: 'WoW Forum', language: 'EN', theme: 'default' };
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { updateForumSettings, getForumSettings, getUsers };