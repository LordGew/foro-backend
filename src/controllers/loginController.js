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

    // Actualizar estado online
    user.isOnline = true;
    await user.save();

    // Generar token con userId (usamos _id de MongoDB convertido a string)
    const token = jwt.sign(
      { 
        userId: user._id.toString(),
        role: user.role 
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '7d'
      }
    );

    // Enviar token solo en el cuerpo de la respuesta (NO en cookies)
    res.json({ 
      message: 'Login exitoso', 
      token,
      user: { 
        id: user._id,
        username: user.username,
        role: user.role,
        xp: user.xp,
        profileImage: user.profileImage ? `http://localhost:5000/uploads/profiles/${user.profileImage}` : null
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
  console.log('Token generado:', token);
};

module.exports = { login };