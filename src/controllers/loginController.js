// src/controllers/loginController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar campos
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
    }

    // Buscar usuario
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Usuario no encontrado:', email);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Verificar contraseña usando el método del modelo
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log('Contraseña incorrecta para:', email);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Generar token con userId (usamos _id de MongoDB convertido a string)
    const token = jwt.sign(
      { 
        userId: user._id.toString(), // ¡Crucial: convertir ObjectId a string!
        role: user.role 
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '7d',
        algorithm: 'HS256'
      }
    );

    console.log('Login exitoso para:', email);
    console.log('Token generado:', token);
    
    // Enviar token en cookie segura y en el cuerpo de la respuesta
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });
    
    res.json({ 
      message: 'Login exitoso', 
      token,
      user: { 
        username: user.username,
        role: user.role,
        userId: user._id.toString()
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

module.exports = { login };