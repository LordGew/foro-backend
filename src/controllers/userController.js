const { io } = require('../../server'); // Elimina esta línea y usa req.io
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

// Contar usuarios
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
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
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
    
    const user = new User({ 
      username, 
      email, 
      password, 
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

// Login
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
    await user.save();

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
        profileImage: user.profileImage ? `${baseUrl}/uploads/profiles/${user.profileImage}` : 'https://via.placeholder.com/40'
      } 
    });
  } catch (err) {
    console.error('Error de login:', err.message);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

// Logout
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
    
    res.json(user);
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

// Get User By Id
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Get Online Users
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
      profileImage: `${baseUrl}/uploads/profiles/${req.file.filename}`
    });
  } catch (err) {
    console.error('Error al actualizar foto de perfil:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

// Search Users
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
      profileImage: user.profileImage || user.avatar || user.profilePicture || null
    }));

    res.status(200).json(normalizedUsers);
  } catch (error) {
    console.error('Error in searchUsers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
// Activate VIP
const activateVip = async (req, res) => {
  try {
    const { duration, userId } = req.body;
    
    // Determinar qué userId usar: el proporcionado (para admins) o el del usuario autenticado
    const targetUserId = userId && req.user.role === 'Admin' ? userId : req.user.userId;
    
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }
    
    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    let expiresAt;
    switch (duration) {
      case 'month':
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        break;
      case 'lifetime':
        expiresAt = null;
        break;
      default:
        return res.status(400).json({ error: 'Duración inválida' });
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
  } catch (error) {
    console.error('Error al activar VIP:', error);
    res.status(500).json({ error: error.message });
  }
};;

// Deactivate VIP
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
        case 'month':
          expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          break;
        case 'lifetime':
          expiresAt = null;
          break;
        default:
          return res.status(400).json({ error: 'Duración inválida' });
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
const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = 'usd', description, duration } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: currency,
      metadata: {
        userId: req.user.userId,
        duration: duration,
        type: 'vip_membership',
        description: description || 'VIP Membership'
      }
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

// Handle Stripe Webhook
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('Payment succeeded:', paymentIntent.id);
    
    const userId = paymentIntent.metadata.userId;
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user) {
          let expiresAt;
          const duration = paymentIntent.metadata.duration;
          switch(duration) {
            case 'month':
              expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              break;
            case 'year':
              expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
              break;
            case 'lifetime':
              expiresAt = null;
              break;
            default:
              expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          }
          
          user.vip = true;
          user.vipExpiresAt = expiresAt;
          await user.save();
          
          console.log('VIP activated for user:', userId);
        }
      } catch (error) {
        console.error('Error activating VIP:', error);
      }
    }
  }
  
  res.json({ received: true });
};
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
// Accept Request (sin modelo Request separado - usa messageRequests en User)
// Accept Request (sin modelo Chat - genera chatId string)
const acceptRequest = async (req, res) => {
  try {
    const requesterId = req.params.id; // ID del solicitante (quien envió la request)
    const receiverId = req.user.userId; // ID del usuario autenticado (quien acepta)

    console.log('Aceptando solicitud:', { requesterId, receiverId });

    // Validar IDs
    if (!mongoose.Types.ObjectId.isValid(requesterId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: 'IDs de usuario inválidos' });
    }

    // Buscar receptor
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Usuario receptor no encontrado' });
    }

    // Verificar si el solicitante está en messageRequests del receptor
    const requesterIndex = receiver.messageRequests.findIndex(rId => rId.toString() === requesterId);
    if (requesterIndex === -1) {
      return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada' });
    }

    // Buscar solicitante
    const requester = await User.findById(requesterId);
    if (!requester) {
      return res.status(404).json({ message: 'Usuario solicitante no encontrado' });
    }

    // Generar chatId único como string (ordenado para consistencia: minId-maxId)
    const ids = [requesterId, receiverId].map(id => id.toString()).sort();
    const chatId = `${ids[0]}-${ids[1]}`;

    console.log('ChatId generado:', chatId);

    // Eliminar de messageRequests del receptor
    receiver.messageRequests.splice(requesterIndex, 1);
    receiver.contacts.push(requesterId); // Agregar a contacts del receptor
    await receiver.save();

    // Agregar receptor a contacts del solicitante (si no existe ya)
    if (!requester.contacts.some(cId => cId.toString() === receiverId)) {
      requester.contacts.push(receiverId);
      await requester.save();
    }

    // Notificar via socket
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

    // Respuesta con el chat "creado" (solo metadata, ya que no hay modelo Chat)
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
  acceptRequest
};