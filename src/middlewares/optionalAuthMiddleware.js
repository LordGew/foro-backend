const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

// Middleware de autenticación opcional
// Popula req.user si hay un token válido, pero no bloquea si no hay token
module.exports = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token) {
    // Sin token, continuar sin usuario autenticado
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId || !mongoose.Types.ObjectId.isValid(decoded.userId)) {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.userId).select('username profileImage role vip vipExpiresAt banned');
    if (!user || user.banned) {
      req.user = null;
      return next();
    }

    req.user = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
      vip: user.vip,
      vipExpiresAt: user.vipExpiresAt,
      profileImage: user.profileImage
    };

    next();
  } catch (err) {
    // Token inválido o expirado, continuar sin usuario
    req.user = null;
    next();
  }
};
