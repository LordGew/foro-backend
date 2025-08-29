const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!validator.isEmail(email) || !username || password.length < 8) {
      return res.status(400).json({ message: 'Invalid input' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ 
      username, 
      email, 
      password: hashedPassword, 
      role: 'Player',
      xp: 0,
      profileImage: null
    });
    await user.save();
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Usuario no encontrado para email: ', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Coincidencia de password: ', isMatch, ' para user: ', email);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ 
      userId: user._id.toString(), 
      role: user.role 
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        role: user.role,
        xp: user.xp,
        profileImage: user.profileImage ? `/uploads/profiles/${user.profileImage}` : 'https://via.placeholder.com/40'
      } 
    });
  } catch (err) {
    console.error('Error de login:', err.message);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logged out' });
};

const updateProfile = async (req, res) => {
  try {
    const { username, email, profilePicture } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId, 
      { username, email, profilePicture }, 
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['Player', 'GameMaster', 'Admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notification = new Notification({ user: user._id, message: `Your role changed to ${role}` });
    await notification.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const banUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { banned: true }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notification = new Notification({ user: user._id, message: 'You have been banned' });
    await notification.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const unbanUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { banned: false }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notification = new Notification({ user: user._id, message: 'You have been unbanned' });
    await notification.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const muteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { muted: true }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notification = new Notification({ user: user._id, message: 'You have been muted' });
    await notification.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const unmuteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { muted: false }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notification = new Notification({ user: user._id, message: 'You have been unmuted' });
    await notification.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado: falta información de usuario' });
    }
    
    if (!req.user.userId) {
      console.error('req.user.userId es undefined. req.user:', req.user);
      return res.status(401).json({ message: 'Token inválido: falta userId' });
    }
    
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json({
      ...user.toObject(),
      profileImage: user.profileImage ? `/uploads/profiles/${user.profileImage}` : 'https://via.placeholder.com/40'
    });
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'Las contraseñas no coinciden' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.log('Contraseña actual incorrecta para usuario:', user.email);
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }
    
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    console.log('Contraseña actualizada para usuario:', user.email);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error al actualizar contraseña:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const updateProfileImage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.profileImage) {
      const oldImagePath = path.join('public/uploads/profiles', user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    user.profileImage = req.file.filename;
    await user.save();

    res.json({ 
      message: 'Foto de perfil actualizada',
      profileImage: `/uploads/profiles/${req.file.filename}`
    });
  } catch (err) {
    console.error('Error al actualizar foto de perfil:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

module.exports = { 
  register, 
  login, 
  logout, 
  updateProfile, 
  changeRole, 
  banUser, 
  unbanUser,
  muteUser,
  unmuteUser,
  updatePassword, 
  getUserProfile,
  updateProfileImage
};