const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

module.exports = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  console.log('Token recibido:', token ? `${token.substring(0, 20)}...` : 'null');

  if (!token) {
    return res.status(401).json({ 
      message: 'No se proporcionó token',
      error: 'no_token'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decodificado:', { userId: decoded.userId });

    if (!decoded.userId) {
      return res.status(401).json({ 
        message: 'Token inválido: falta userId',
        error: 'invalid_token'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(decoded.userId)) {
      return res.status(401).json({ 
        message: 'Token inválido: userId no es un ObjectId válido',
        error: 'invalid_token'
      });
    }

    const user = await User.findById(decoded.userId).select('username profileImage role vip vipExpiresAt banned isOnline lastActivity');
    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado',
        error: 'user_not_found'
      });
    }

    if (user.banned) {
      return res.status(403).json({ 
        message: 'Estás baneado y no puedes realizar acciones',
        error: 'banned'
      });
    }

    // Actualizar última actividad y estado online
    try {
      user.lastActivity = new Date();
      user.isOnline = true;
      await user.save();
    } catch (updateErr) {
      console.error('Error al actualizar lastActivity en authMiddleware:', updateErr);
    }

    req.user = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
      vip: user.vip,
      vipExpiresAt: user.vipExpiresAt,
      profileImage: user.profileImage
    };

    console.log('Usuario autenticado:', { userId: req.user.userId, role: req.user.role, vip: req.user.vip });
    next();
  } catch (err) {
    console.error('Error al verificar token:', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expirado. Por favor, inicia sesión nuevamente.',
        error: 'token_expired'
      });
    }
    return res.status(401).json({ 
      message: 'Token inválido o malformado.',
      error: 'invalid_token'
    });
  }
};
