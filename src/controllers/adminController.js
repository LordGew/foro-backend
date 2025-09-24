// src/controllers/adminController.js
const AdminSettings = require('../models/AdminSettings');
const User = require('../models/User');

const updateForumSettings = async (req, res) => {
  try {
    const { forumName, language, theme } = req.body;
    const settings = await AdminSettings.findOneAndUpdate(
      {}, 
      { forumName, language, theme }, 
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      settings
    });
  } catch (err) {
    console.error('Error al actualizar configuración:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getForumSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.findOne() || { 
      forumName: 'WoW Forum', 
      language: 'EN', 
      theme: 'default' 
    };
    
    res.json({
      success: true,
      settings
    });
  } catch (err) {
    console.error('Error al obtener configuración:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Formatear usuarios para el frontend
    const formattedUsers = users.map(user => ({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      xp: user.xp,
      profileImage: user.profileImage 
        ? `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/profiles/${user.profileImage}`
        : null,
      banned: user.banned || false,
      muted: user.muted || false,
      banReason: user.banReason,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));

    res.json(formattedUsers);
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

module.exports = { 
  updateForumSettings, 
  getForumSettings, 
  getUsers 
};