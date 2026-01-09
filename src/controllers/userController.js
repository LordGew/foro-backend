// userController.js
// Este archivo contiene todos los controladores para las rutas relacionadas con usuarios.
// Incluye funciones para registro, login, logout, actualización de perfil, cambio de rol, ban/mute, etc.
// También maneja la lógica de VIP y pagos con Stripe.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})
const baseUrl = process.env.BACKEND_URL || 'https://foro-backend-9j93.onrender.com';

// Refresh Token
// Esta función regenera el token JWT con los datos actuales del usuario desde la base de datos
const refreshToken = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Obtener datos actualizados del usuario desde la BD
    const user = await User.findById(userId).select('username email role vip vipExpiresAt profileImage');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Generar nuevo token con datos actualizados
    const token = jwt.sign(
      { 
        userId: user._id.toString(),
        username: user.username,
        role: user.role,
        vip: user.vip
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log(`🔄 Token refrescado para usuario ${user.username} (${user.role})`);
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        vip: user.vip,
        vipExpiresAt: user.vipExpiresAt,
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    console.error('Error al refrescar token:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

// Contar usuarios
// Esta función cuenta el número total de usuarios en la base de datos y devuelve el conteo.
const getUsersCount = async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error('Error al contar usuarios:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

// Registro
// Esta función registra un nuevo usuario, validando los inputs y comprobando si el username o email ya existen.
const register = async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;
    
    if (!validator.isEmail(email) || !username || password.length < 8) {
      return res.status(400).json({ message: 'Invalid input' });
    }
    
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    // Si hay código de referido, verificar que existe
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
      if (!referrer) {
        return res.status(400).json({ message: 'Código de referido inválido' });
      }
    }
    
    const user = new User({ 
      username, 
      email, 
      password, 
      role: 'Player',
      xp: 0,
      profileImage: '',
      referredBy: referrer ? referrer._id : null
    });
    
    await user.save();
    
    // Si hay referidor, crear el referido y otorgar puntos
    if (referrer) {
      const Referral = require('../models/Referral');
      
      // Crear referido en estado PENDING
      const referral = new Referral({
        referrer: referrer._id,
        referred: user._id,
        referralCode: referralCode,
        pointsAwarded: 100,
        status: 'pending',
        completedAt: null
      });
      
      await referral.save();
      
      // NUEVO: Dar 50 puntos inmediatos al nuevo usuario como bienvenida
      user.referralPoints = 50;
      await user.save();
      
      // Actualizar contador del referidor (los 100 puntos se darán cuando cumpla requisitos)
      referrer.totalReferrals += 1;
      await referrer.save();
      
      console.log(`✅ Referido creado: ${username} fue referido por ${referrer.username}. Nuevo usuario recibió 50 puntos. Referidor recibirá 100 puntos cuando se cumplan requisitos.`);
    }
    
    res.status(201).json({ 
      message: 'User registered',
      referralApplied: !!referrer
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

// Login
// Esta función maneja el inicio de sesión, validando credenciales y generando un token JWT.
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Usuario no encontrado para email:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await user.matchPassword(password);
    console.log('Password comparison result:', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    user.isOnline = true;
    user.lastLogin = new Date();
    await user.save();

    // Actualizar progreso de misión de login diario
    const missionController = require('./missionController');
    await missionController.updateMissionProgress(user._id, 'daily_login', 1);

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
       profileImage: user.profileImage || ''
      } 
    });
  } catch (err) {
    console.error('Error de login:', err.message);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

// Logout
// Esta función maneja el cierre de sesión, actualizando el estado online del usuario.
const logout = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        user.isOnline = false;
        await user.save();
      }
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Error en logout:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Update Profile
// Esta función actualiza el perfil del usuario, como username o email.
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

// Change Role
// Esta función cambia el rol de un usuario, notificando al usuario afectado.
const changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['Player', 'GameMaster', 'Admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
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

// Ban User
// Esta función banea a un usuario, notificando y emitiendo un evento via socket.
const banUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { banned: true }, { new: true, runValidators: true })
      .select('banned muted');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const notification = new Notification({ user: user._id, message: 'You have been banned' });
    await notification.save();

    if (req.io) {
      req.io.to(user._id.toString()).emit('userBanned', {
        message: 'Has sido baneado por un moderador',
        userId: user._id,
        banned: user.banned
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Unban User
// Esta función desbanea a un usuario, notificando y emitiendo un evento via socket.
const unbanUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { banned: false }, { new: true, runValidators: true })
      .select('banned muted');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const notification = new Notification({ user: user._id, message: 'You have been unbanned' });
    await notification.save();

    if (req.io) {
      req.io.to(user._id.toString()).emit('userUnbanned', {
        message: 'Has sido desbaneado por un moderador',
        userId: user._id,
        banned: user.banned
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mute User
// Esta función silencia a un usuario, notificando y emitiendo un evento via socket.
const muteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { muted: true }, { new: true, runValidators: true })
      .select('banned muted');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const notification = new Notification({ user: user._id, message: 'You have been muted' });
    await notification.save();

    if (req.io) {
      req.io.to(user._id.toString()).emit('userMuted', {
        message: 'Has sido silenciado por un moderador',
        userId: user._id,
        muted: user.muted
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Unmute User
// Esta función des-silencia a un usuario, notificando y emitiendo un evento via socket.
const unmuteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { muted: false }, { new: true, runValidators: true })
      .select('banned muted');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const notification = new Notification({ user: user._id, message: 'You have been unmuted' });
    await notification.save();

    if (req.io) {
      req.io.to(user._id.toString()).emit('userUnmuted', {
        message: 'Has sido des-silenciado por un moderador',
        userId: user._id,
        muted: user.muted
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get User Profile
// Esta función obtiene el perfil del usuario autenticado, excluyendo la contraseña.
const getUserProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado: falta información de usuario' });
    }
    
    if (!req.user.userId) {
      console.error('req.user.userId es undefined. req.user:', req.user);
      return res.status(401).json({ message: 'Token inválido: falta userId' });
    }
    
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('activeRewards.emoji')
      .populate('activeRewards.title')
      .populate('activeRewards.theme')
      .populate('activeRewards.frame')
      .populate('badges');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

// Get User By Id
// Esta función obtiene el perfil de un usuario por ID, excluyendo la contraseña.
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(id)
      .select('-password')
      .populate('activeRewards.emoji')
      .populate('activeRewards.title')
      .populate('activeRewards.theme')
      .populate('activeRewards.frame')
      .populate('badges');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Get Online Users
// Esta función obtiene la lista de usuarios online, incluyendo el usuario actual.
const getOnlineUsers = async (req, res) => {
  try {
    console.log('Solicitud recibida para obtener usuarios online');
    
    if (!req.user || !req.user.userId) {
      console.error('req.user o req.user.userId es undefined:', req.user);
      return res.status(401).json({ 
        message: 'No autorizado: falta información de usuario' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.user.userId)) {
      console.error('ID de usuario inválido:', req.user.userId);
      return res.status(400).json({ 
        message: 'ID de usuario inválido' 
      });
    }

    const users = await User.find({ isOnline: true }).select('username _id profileImage role');
    
    console.log(`Encontrados ${users.length} usuarios online`);
    
    const currentUserId = new mongoose.Types.ObjectId(req.user.userId);
    const currentUserIndex = users.findIndex(u => u._id.toString() === currentUserId.toString());
    
    if (currentUserIndex === -1) {
      try {
        const currentUser = await User.findById(currentUserId).select('username _id profileImage role');
        if (currentUser) {
          users.unshift(currentUser);
        }
      } catch (userError) {
        console.error('Error al buscar usuario actual:', userError);
      }
    }
    
    res.json(users);
  } catch (err) {
    console.error('Error fetching online users:', err);
    res.status(500).json({ 
      message: 'Error interno del servidor', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Update Password
// Esta función actualiza la contraseña del usuario autenticado, validando la contraseña actual.
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
    
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
      console.log('Contraseña actual incorrecta para usuario:', user.email);
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }
    
    user.password = newPassword;
    await user.save();
    
    console.log('Contraseña actualizada para usuario:', user.email);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error al actualizar contraseña:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

// Update Profile Image
const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se subió ninguna imagen' });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Subir la imagen a Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'image', folder: 'profiles' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    // Guardar la URL completa de Cloudinary
    user.profileImage = result.secure_url;
    await user.save();

    console.log('Imagen de perfil actualizada:', result.secure_url);
    res.json({ 
      message: 'Foto de perfil actualizada',
      profileImage: result.secure_url // Devolver URL completa
    });
  } catch (err) {
    console.error('Error al actualizar imagen de perfil:', err);
    res.status(500).json({ message: 'Error interno del servidor al subir la imagen', error: err.message });
  }
};

// Search Users
// Esta función busca usuarios por username o name, limitando a 10 resultados.
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Query parameter "q" is required' });
    }

    const regex = new RegExp(q, 'i'); // Case-insensitive search
    const users = await User.find({
      $or: [
        { username: regex },
        { name: regex }
      ]
    }).select('_id username name profileImage avatar profilePicture').limit(10);

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    const normalizedUsers = users.map(user => ({
      _id: user._id,
      username: user.username,
      name: user.name,
     profileImage: user.profileImage || ''
    }));

    res.status(200).json(normalizedUsers);
  } catch (error) {
    console.error('Error in searchUsers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Activate VIP
// Esta función activa el modo VIP para el usuario autenticado o para otro usuario si es admin, calculando la fecha de expiración.
const activateVip = async (req, res) => {
  try {
    const { duration, userId } = req.body;
    const VIPBenefit = require('../models/VIPBenefit');
    
    // Determinar qué userId usar: el proporcionado (para admins) o el del usuario autenticado
    const targetUserId = userId && req.user.role === 'Admin' ? userId : req.user.userId;
    
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }
    
    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    let expiresAt;
    let vipTier = 'basic';
    switch (duration) {
      case 'bimonthly': 
        expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        vipTier = 'basic';
        break;
      case 'year': 
        expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        vipTier = 'premium';
        break;
      case 'lifetime': 
        expiresAt = null;
        vipTier = 'lifetime';
        break;
      default: 
        expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        vipTier = 'basic';
    }
    
    user.vip = true;
    user.vipExpiresAt = expiresAt;
    user.vipTier = vipTier;
    
    // Crear o actualizar beneficios VIP
    let benefits = await VIPBenefit.findOne({ userId: user._id });
    if (!benefits) {
      benefits = new VIPBenefit({
        userId: user._id,
        customColor: '#FFD700',
        xpMultiplier: 1.5
      });
      await benefits.save();
      user.vipBenefits = benefits._id;
    }
    
    await user.save();
    res.json({ status: 'vip_activated', expiresAt, vipTier });
  } catch (error) {
    console.error('Error al activar VIP:', error);
    res.status(500).json({ error: 'Error processing VIP activation' });
  }
};

// Deactivate VIP
// Esta función desactiva el modo VIP para el usuario autenticado.
const deactivateVip = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    user.vip = false;
    user.vipExpiresAt = null;
    await user.save();
    
    res.json({ message: 'VIP desactivado exitosamente', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Check VIP Status
// Esta función verifica el estado VIP del usuario autenticado.
const checkVipStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    res.json({ 
      isVip: user.vip || false,
      vipExpiresAt: user.vipExpiresAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Process VIP Payment
// Esta función procesa un pago VIP usando Stripe Payment Intent (obsoleta, se recomienda usar createPaymentIntent).
const processVipPayment = async (req, res) => {
  try {
    const { amount, currency, duration, paymentMethodId } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: currency || 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        userId: req.user.userId,
        duration: duration,
        type: 'vip_membership'
      }
    });
    
    if (paymentIntent.status === 'succeeded') {
      let expiresAt;
      switch(duration) {
        case 'bimonthly':
          expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          break;
        case 'lifetime':
          expiresAt = null;
          break;
        default:
          expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      }
      
      user.vip = true;
      user.vipExpiresAt = expiresAt;
      await user.save();
      
      res.json({ 
        message: 'VIP activado exitosamente',
        user: {
          ...user.toObject(),
          vipExpiresAt: user.vipExpiresAt
        }
      });
    } else {
      res.status(400).json({ error: 'Pago fallido' });
    }
  } catch (error) {
    console.error('Error procesando pago:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create Payment Intent
// Esta función crea un Payment Intent con Stripe para procesar pagos VIP, asegurando que el monto sea válido.
const createPaymentIntent = async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe no está configurado. Verifica la clave secreta.' });
  }
  try {
    const { amount, currency = 'usd', duration, success_url, cancel_url } = req.body;
    const { createVipTransaction } = require('./vipController');
    
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Amount must be at least 50 cents' });
    }
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: currency,
          product_data: {
            name: `VIP Membership - ${duration === 'bimonthly' ? '60 días' : duration === 'year' ? '1 año' : 'Vitalicio'}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url,
      cancel_url,
      metadata: { duration, userId: req.user.userId }
    });
    
    // Crear registro de transacción
    await createVipTransaction(req.user.userId, amount, currency, duration, session.id);
    
    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

// Handle Stripe Webhook
// Esta función maneja los webhooks de Stripe para eventos como pagos completados, activando VIP automáticamente.
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const { completeVipTransaction } = require('./vipController');

  if (!webhookSecret) {
    return res.status(400).send('Webhook secret missing');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    console.log('✅ Pago completado vía webhook:', event.data.object.id);
    const session = event.data.object;
    
    try {
      await completeVipTransaction(session.id, session.payment_intent);
      console.log('✅ Transacción VIP completada exitosamente');
    } catch (error) {
      console.error('❌ Error al completar transacción VIP:', error);
    }
  }

  res.status(200).end();
};

// Unblock User
// Esta función desbloquea a un usuario de la lista de bloqueados del usuario autenticado.
const unblockUser = async (req, res) => {
  try {
    const { id } = req.params; // ID del usuario a desbloquear
    const userId = req.user.userId; // ID del usuario autenticado (desde authMiddleware)

    // Buscar al usuario autenticado
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario autenticado no encontrado' });
    }

    // Verificar si el usuario objetivo está en la lista de bloqueados
    if (!user.blockedUsers.includes(id)) {
      return res.status(400).json({ message: 'El usuario no está bloqueado' });
    }

    // Eliminar al usuario de la lista de bloqueados
    user.blockedUsers = user.blockedUsers.filter(uid => uid.toString() !== id);
    await user.save();

    // Respuesta exitosa
    res.status(200).json({ message: 'Usuario desbloqueado correctamente' });
  } catch (error) {
    console.error('Error en unblockUser:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Accept Request
// Esta función acepta una solicitud de chat, generando un chatId y actualizando contactos.
const acceptRequest = async (req, res) => {
  try {
    const requesterId = req.params.id; // ID del solicitante (quien envió la request)
    const receiverId = req.user.userId; // ID del usuario autenticado (quien acepta)

    if (!mongoose.Types.ObjectId.isValid(requesterId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: 'IDs de usuario inválidos' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Usuario receptor no encontrado' });
    }

    const requesterIndex = receiver.messageRequests.findIndex(rId => rId.toString() === requesterId);
    if (requesterIndex === -1) {
      return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada' });
    }

    const requester = await User.findById(requesterId);
    if (!requester) {
      return res.status(404).json({ message: 'Usuario solicitante no encontrado' });
    }

    const ids = [requesterId, receiverId].map(id => id.toString()).sort();
    const chatId = `${ids[0]}-${ids[1]}`;

    receiver.messageRequests.splice(requesterIndex, 1);
    receiver.contacts.push(requesterId);
    await receiver.save();

    if (!requester.contacts.some(cId => cId.toString() === receiverId)) {
      requester.contacts.push(receiverId);
      await requester.save();
    }

    if (req.io) {
      req.io.to(requesterId.toString()).emit('requestAccepted', {
        chatId,
        message: 'Tu solicitud de chat ha sido aceptada. ¡Puedes chatear ahora!'
      });
      req.io.to(receiverId.toString()).emit('chatCreated', { 
        chatId, 
        user: { _id: requesterId, username: requester.username } 
      });
    }

    const chatResponse = {
      id: chatId,  // Como 'id' para frontend
      chatId: chatId,
      users: [requesterId, receiverId],
      status: 'active',
      lastMessageAt: new Date(),
      unreadCount: 0,
      lastSnippet: ''
    };

    res.status(200).json(chatResponse);
  } catch (error) {
    console.error('Error en acceptRequest:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
// Función para limpiar profileImage al iniciar el servidor
const cleanProfileImages = async () => {
  try {
    const users = await User.find({ profileImage: { $exists: true, $ne: '' } });
    let cleanedCount = 0;
    for (const user of users) {
      if (user.profileImage && !user.profileImage.startsWith('https://res.cloudinary.com/')) {
        if (user.profileImage.includes('/uploads/profiles/')) {
          const cloudinaryUrl = user.profileImage.match(/https:\/\/res\.cloudinary\.com\/.*/)?.[0];
          user.profileImage = cloudinaryUrl || '';
          await user.save();
          console.log(`✅ profileImage corregido para usuario ${user._id}: ${user.profileImage}`);
          cleanedCount++;
        } else {
          console.warn(`Usuario ${user._id} tiene profileImage inválido: ${user.profileImage}`);
          user.profileImage = '';
          await user.save();
          console.log(`✅ profileImage reseteado para usuario ${user._id}`);
          cleanedCount++;
        }
      }
    }
    console.log(`✅ Limpieza de profileImage completada. Usuarios corregidos: ${cleanedCount}`);
  } catch (err) {
    console.error('❌ Error en limpieza de profileImage:', err);
  }
};

// Actualizar presentación RPG
const updateRoleplayIntro = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { roleplayIntro } = req.body;

    if (!roleplayIntro || roleplayIntro.trim() === '') {
      return res.status(400).json({ message: 'La presentación no puede estar vacía' });
    }

    if (roleplayIntro.length > 200) {
      return res.status(400).json({ message: 'La presentación no puede exceder 200 caracteres' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { roleplayIntro: roleplayIntro.trim() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    console.log(`✅ Presentación RPG actualizada para ${user.username}: "${roleplayIntro}"`);
    res.json({ message: 'Presentación actualizada exitosamente', user });
  } catch (error) {
    console.error('Error al actualizar presentación RPG:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
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
  getUserById,
  updateProfileImage,
  searchUsers,
  getOnlineUsers,
  getUsersCount,
  activateVip,
  deactivateVip,
  checkVipStatus,
  processVipPayment,
  createPaymentIntent,
  handleStripeWebhook,
  unblockUser,
  acceptRequest,
  cleanProfileImages,
  refreshToken,
  updateRoleplayIntro
};
