// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Intenta obtener el token de diferentes lugares
  let token = req.header('Authorization');
  
  // 1. Verifica en el header Authorization
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7, token.length);
  } 
  // 2. Verifica en cookies si no está en el header
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 3. Verifica en el body para métodos como POST/PUT
  else if (req.body && req.body.token) {
    token = req.body.token;
  }

  if (!token) {
    console.log('No se proporcionó token');
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decodificado correctamente:', decoded);
    
    // Asegúrate de que userId esté presente
    if (!decoded.userId) {
      console.error('Token decodificado sin userId:', decoded);
      return res.status(401).json({ 
        message: 'Token inválido: falta userId' 
      });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Error al verificar token:', err);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expirado. Por favor, inicia sesión nuevamente.' 
      });
    }
    
    res.status(401).json({ 
      message: 'Invalid token',
      error: err.message 
    });
  }
};  