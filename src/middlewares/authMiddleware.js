const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

module.exports = async (req, res, next) => {
  // Obtener token del header Authorization
  const authHeader = req.header('Authorization');
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim(); // Añade trim() para limpiar espacios
  }

  // Log para depuración
  console.log('Token recibido:', token ? `${token.substring(0, 20)}...` : 'null');

  if (!token) {
    return res.status(401).json({ 
      message: 'No token provided',
      error: 'no_token'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Log para depuración
    console.log('Token decodificado:', decoded);
    
    if (!decoded.userId) {
      return res.status(401).json({ 
        message: 'Token inválido: falta userId',
        error: 'invalid_token'
      });
    }
    
    // Verificar que el userId sea un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(decoded.userId)) {
      return res.status(401).json({ 
        message: 'Token inválido: userId no es un ObjectId válido',
        error: 'invalid_token'
      });
    }
    
    req.user = decoded;
    const user = await User.findById(decoded.userId);
    
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