const User = require('../models/User');
const Referral = require('../models/Referral');
const RewardItem = require('../models/RewardItem');
const rewardsData = require('../data/rewards-data');
const crypto = require('crypto');

// Generar código de referido único
const generateReferralCode = async () => {
  let code;
  let exists = true;
  
  while (exists) {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const user = await User.findOne({ referralCode: code });
    exists = !!user;
  }
  
  return code;
};

// Obtener o crear código de referido del usuario
exports.getMyReferralCode = async (req, res) => {
  try {
    const userId = req.user.userId;
    let user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    if (!user.referralCode) {
      user.referralCode = await generateReferralCode();
      await user.save();
    }
    
    res.json({
      referralCode: user.referralCode,
      referralLink: `${process.env.FRONTEND_URL}/register?ref=${user.referralCode}`,
      totalReferrals: user.totalReferrals,
      referralPoints: user.referralPoints
    });
  } catch (err) {
    console.error('Error getting referral code:', err);
    res.status(500).json({ message: 'Error al obtener código de referido', error: err.message });
  }
};

/**
 * REGLAS DE VALIDACIÓN DE REFERIDOS:
 * 
 * 1. VALIDACIONES ANTI-FRAUDE:
 *    - No se permite usar el propio código de referido
 *    - No se permite usar un código más de una vez
 *    - Detección de misma IP (si está disponible en req.ip)
 *    - El usuario debe completar su perfil
 * 
 * 2. REQUISITOS PARA ACREDITACIÓN DE PUNTOS:
 *    - El referido debe crear al menos 1 post O 3 comentarios
 *    - El referido debe permanecer activo por al menos 2 días (cambiado de 7 días)
 *    - Estado inicial: 'pending' (pendiente de validación)
 *    - Estado final: 'completed' (puntos acreditados)
 * 
 * 3. PUNTOS OTORGADOS:
 *    - NUEVO USUARIO: 50 puntos inmediatos al registrarse con código de referido
 *    - REFERIDOR: 100 puntos cuando el referido cumple los requisitos (2 días + actividad)
 * 
 * 4. TIEMPO DE VALIDACIÓN:
 *    - Los puntos del referidor se acreditan automáticamente cuando se cumplen todos los requisitos
 *    - Un job programado verifica diariamente los referidos pendientes
 */

// Aplicar código de referido al registrarse
exports.applyReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user.userId;
    const userIp = req.ip || req.connection.remoteAddress;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    if (user.referredBy) {
      return res.status(400).json({ message: 'Ya has usado un código de referido' });
    }
    
    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(404).json({ message: 'Código de referido inválido' });
    }
    
    if (referrer._id.toString() === userId) {
      return res.status(400).json({ message: 'No puedes usar tu propio código de referido' });
    }
    
    // VALIDACIÓN ANTI-FRAUDE: Verificar misma IP
    if (userIp && referrer.lastLoginIp && userIp === referrer.lastLoginIp) {
      console.warn(`Intento de fraude detectado: Misma IP ${userIp} para referrer ${referrer._id} y referred ${userId}`);
      return res.status(400).json({ 
        message: 'No se puede validar el referido. Contacta con soporte si crees que es un error.',
        reason: 'fraud_detection'
      });
    }
    
    // Verificar que no exista ya este referido
    const existingReferral = await Referral.findOne({
      referrer: referrer._id,
      referred: userId
    });
    
    if (existingReferral) {
      return res.status(400).json({ message: 'Ya has sido referido por este usuario' });
    }
    
    // Crear referido en estado PENDING (pendiente de validación)
    const referral = new Referral({
      referrer: referrer._id,
      referred: userId,
      referralCode: referralCode,
      pointsAwarded: 100,
      status: 'pending', // CAMBIO: Inicia como pendiente
      completedAt: null
    });
    
    await referral.save();
    
    // Actualizar usuario referido
    user.referredBy = referrer._id;
    
    // NUEVO: Dar 50 puntos inmediatos al nuevo usuario como bienvenida
    user.referralPoints = (user.referralPoints || 0) + 50;
    await user.save();
    
    // Los 100 puntos del referidor se acreditarán cuando el referido cumpla los requisitos
    referrer.totalReferrals += 1; // Solo incrementamos el contador de referidos totales
    await referrer.save();
    
    // Emitir notificación de referido pendiente
    if (req.io) {
      req.io.to(referrer._id.toString()).emit('referralPending', {
        referredUser: user.username,
        message: 'Nuevo referido pendiente de validación'
      });
    }
    
    res.json({
      message: '¡Bienvenido! Has recibido 50 puntos de regalo. Tu referidor recibirá 100 puntos cuando completes los requisitos de actividad.',
      status: 'pending',
      pointsReceived: 50,
      requirements: {
        profileComplete: false,
        minimumActivity: 'Crear 1 post o 3 comentarios',
        minimumDays: 2,
        referrerPointsToEarn: 100
      },
      referrer: {
        username: referrer.username,
        _id: referrer._id
      }
    });
  } catch (err) {
    console.error('Error applying referral code:', err);
    res.status(500).json({ message: 'Error al aplicar código de referido', error: err.message });
  }
};

// Obtener mis referidos
exports.getMyReferrals = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const referrals = await Referral.find({ referrer: userId })
      .populate('referred', 'username profileImage createdAt')
      .sort({ createdAt: -1 });
    
    const user = await User.findById(userId);
    
    res.json({
      referrals: referrals.map(r => ({
        username: r.referred.username,
        profileImage: r.referred.profileImage,
        pointsEarned: r.pointsAwarded,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt
      })),
      totalReferrals: user.totalReferrals,
      totalPoints: user.referralPoints
    });
  } catch (err) {
    console.error('Error getting referrals:', err);
    res.status(500).json({ message: 'Error al obtener referidos', error: err.message });
  }
};

// Obtener todas las recompensas disponibles
exports.getRewards = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { isActive: true };
    
    if (type) {
      filter.type = type;
    }
    
    const rewards = await RewardItem.find(filter).sort({ cost: 1, rarity: 1 });
    
    res.json(rewards);
  } catch (err) {
    console.error('Error getting rewards:', err);
    res.status(500).json({ message: 'Error al obtener recompensas', error: err.message });
  }
};

// Debug: Obtener todas las recompensas (incluyendo inactivas)
exports.debugGetAllRewards = async (req, res) => {
  try {
    const allRewards = await RewardItem.find({});
    const activeRewards = await RewardItem.find({ isActive: true });
    
    res.json({
      total: allRewards.length,
      active: activeRewards.length,
      inactive: allRewards.length - activeRewards.length,
      rewards: allRewards.map(r => ({
        _id: r._id.toString(),
        name: r.name,
        type: r.type,
        cost: r.cost,
        isActive: r.isActive,
        rarity: r.rarity
      }))
    });
  } catch (err) {
    console.error('Error getting all rewards:', err);
    res.status(500).json({ message: 'Error al obtener recompensas', error: err.message });
  }
};

// Comprar una recompensa
exports.purchaseReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const reward = await RewardItem.findById(rewardId);
    if (!reward || !reward.isActive) {
      return res.status(404).json({ message: 'Recompensa no encontrada o no disponible' });
    }
    
    // Verificar si ya tiene la recompensa
    const alreadyOwned = user.ownedRewards.some(r => r.rewardId.toString() === rewardId);
    if (alreadyOwned) {
      return res.status(400).json({ message: 'Ya posees esta recompensa' });
    }
    
    // Verificar puntos suficientes
    if (user.referralPoints < reward.cost) {
      return res.status(400).json({ 
        message: 'Puntos insuficientes',
        required: reward.cost,
        available: user.referralPoints
      });
    }
    
    // Realizar compra
    user.referralPoints -= reward.cost;
    user.ownedRewards.push({
      rewardId: reward._id,
      purchasedAt: new Date()
    });
    
    await user.save();
    
    res.json({
      message: 'Recompensa comprada exitosamente',
      reward: reward,
      remainingPoints: user.referralPoints
    });
  } catch (err) {
    console.error('Error purchasing reward:', err);
    res.status(500).json({ message: 'Error al comprar recompensa', error: err.message });
  }
};

// Obtener recompensas del usuario
exports.getMyRewards = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId)
      .populate('ownedRewards.rewardId')
      .populate('activeRewards.emoji')
      .populate('activeRewards.title')
      .populate('activeRewards.theme')
      .populate('activeRewards.frame');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json({
      ownedRewards: user.ownedRewards,
      activeRewards: user.activeRewards,
      referralPoints: user.referralPoints
    });
  } catch (err) {
    console.error('Error getting user rewards:', err);
    res.status(500).json({ message: 'Error al obtener recompensas', error: err.message });
  }
};

// Activar/equipar una recompensa
exports.equipReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const userId = req.user.userId;
    
    console.log('🎯 EquipReward - RewardId:', rewardId);
    console.log('🎯 EquipReward - UserId:', userId);
    
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ Usuario no encontrado:', userId);
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    console.log('✅ Usuario encontrado:', user.username);
    console.log('📦 Recompensas del usuario:', user.ownedRewards.map(r => ({
      rewardId: r.rewardId.toString(),
      purchasedAt: r.purchasedAt
    })));
    
    const reward = await RewardItem.findById(rewardId);
    if (!reward) {
      console.log('❌ Recompensa no encontrada con ID:', rewardId);
      
      // Listar todas las recompensas disponibles para debugging
      const allRewards = await RewardItem.find({});
      console.log('📋 Recompensas disponibles en BD:', allRewards.map(r => ({
        _id: r._id.toString(),
        name: r.name,
        type: r.type,
        isActive: r.isActive
      })));
      
      return res.status(404).json({ 
        message: 'Recompensa no encontrada',
        requestedId: rewardId,
        availableRewards: allRewards.map(r => r._id.toString())
      });
    }
    
    console.log('✅ Recompensa encontrada:', reward.name);
    
    // Verificar que el usuario posee la recompensa
    const owned = user.ownedRewards.some(r => r.rewardId.toString() === rewardId);
    if (!owned) {
      console.log('❌ Usuario no posee esta recompensa. Recompensas propias:', user.ownedRewards.map(r => r.rewardId.toString()));
      return res.status(403).json({ message: 'No posees esta recompensa' });
    }
    
    console.log('✅ Usuario posee la recompensa');
    
    // Equipar la recompensa según su tipo
    user.activeRewards[reward.type] = reward._id;
    await user.save();
    
    console.log('✅ Recompensa equipada exitosamente');
    
    res.json({
      message: 'Recompensa equipada exitosamente',
      activeRewards: user.activeRewards
    });
  } catch (err) {
    console.error('❌ Error equipping reward:', err);
    res.status(500).json({ message: 'Error al equipar recompensa', error: err.message });
  }
};

// Desequipar una recompensa
exports.unequipReward = async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.userId;
    
    if (!['emoji', 'title', 'theme', 'frame'].includes(type)) {
      return res.status(400).json({ message: 'Tipo de recompensa inválido' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    user.activeRewards[type] = null;
    await user.save();
    
    res.json({
      message: 'Recompensa desequipada exitosamente',
      activeRewards: user.activeRewards
    });
  } catch (err) {
    console.error('Error unequipping reward:', err);
    res.status(500).json({ message: 'Error al desequipar recompensa', error: err.message });
  }
};

// Admin: Crear recompensa
exports.createReward = async (req, res) => {
  try {
    const { name, description, type, cost, content, rarity, previewImage, metadata, slug, iconUrl, iconHtml } = req.body;
    
    if (!name || !description || !type || cost === undefined || !content) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    
    const reward = new RewardItem({
      name,
      description,
      type,
      cost,
      content,
      rarity: rarity || 'common',
      previewImage,
      metadata,
      slug,
      iconUrl,
      iconHtml,
      isActive: true
    });
    
    await reward.save();
    
    res.status(201).json({
      message: 'Recompensa creada exitosamente',
      reward
    });
  } catch (err) {
    console.error('Error creating reward:', err);
    res.status(500).json({ message: 'Error al crear recompensa', error: err.message });
  }
};

// Admin: Forzar seed de recompensas
exports.seedRewards = async (req, res) => {
  try {
    const seedRewards = require('../seeds/rewardsSeed');
    
    // Limpiar recompensas existentes
    const deletedCount = await RewardItem.deleteMany({});
    console.log(`🗑️ ${deletedCount.deletedCount} recompensas eliminadas`);
    
    // Ejecutar seed
    await seedRewards();
    
    // Obtener recompensas creadas
    const rewards = await RewardItem.find({});
    
    res.json({
      message: 'Recompensas regeneradas exitosamente',
      count: rewards.length,
      rewards: rewards.map(r => ({
        _id: r._id.toString(),
        name: r.name,
        type: r.type,
        cost: r.cost,
        rarity: r.rarity
      }))
    });
  } catch (err) {
    console.error('Error seeding rewards:', err);
    res.status(500).json({ message: 'Error al regenerar recompensas', error: err.message });
  }
};

// Admin: Actualizar recompensa
exports.updateReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const updates = req.body;
    
    const reward = await RewardItem.findByIdAndUpdate(
      rewardId,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!reward) {
      return res.status(404).json({ message: 'Recompensa no encontrada' });
    }
    
    res.json({
      message: 'Recompensa actualizada exitosamente',
      reward
    });
  } catch (err) {
    console.error('Error updating reward:', err);
    res.status(500).json({ message: 'Error al actualizar recompensa', error: err.message });
  }
};

// Admin: Eliminar recompensa
exports.deleteReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    
    const reward = await RewardItem.findByIdAndUpdate(
      rewardId,
      { isActive: false },
      { new: true }
    );
    
    if (!reward) {
      return res.status(404).json({ message: 'Recompensa no encontrada' });
    }
    
    res.json({
      message: 'Recompensa desactivada exitosamente',
      reward
    });
  } catch (err) {
    console.error('Error deleting reward:', err);
    res.status(500).json({ message: 'Error al eliminar recompensa', error: err.message });
  }
};

/**
 * JOB AUTOMÁTICO: Validar referidos pendientes
 * 
 * Esta función debe ejecutarse diariamente (mediante cron job o similar)
 * para verificar si los referidos pendientes han cumplido los requisitos
 * y acreditar los puntos correspondientes.
 */
exports.validatePendingReferrals = async (req, res) => {
  try {
    const pendingReferrals = await Referral.find({ status: 'pending' })
      .populate('referrer')
      .populate('referred');
    
    let validatedCount = 0;
    let cancelledCount = 0;
    
    for (const referral of pendingReferrals) {
      const referred = referral.referred;
      const referrer = referral.referrer;
      
      if (!referred || !referrer) continue;
      
      // Verificar tiempo mínimo (2 días desde el registro)
      const daysSinceRegistration = Math.floor((Date.now() - new Date(referred.createdAt)) / (1000 * 60 * 60 * 24));
      
      if (daysSinceRegistration < 2) {
        continue; // Aún no cumple el tiempo mínimo
      }
      
      // Verificar perfil completo (al menos tiene username y email)
      const profileComplete = referred.username && referred.email;
      
      // Verificar actividad mínima
      const Post = require('../models/Post');
      const Reply = require('../models/Reply');
      
      const postCount = await Post.countDocuments({ author: referred._id });
      const replyCount = await Reply.countDocuments({ author: referred._id });
      
      const hasMinimumActivity = postCount >= 1 || replyCount >= 3;
      
      // Validar si cumple todos los requisitos
      if (profileComplete && hasMinimumActivity && daysSinceRegistration >= 2) {
        // ACREDITAR PUNTOS
        referral.status = 'completed';
        referral.completedAt = new Date();
        await referral.save();
        
        referrer.referralPoints += referral.pointsAwarded;
        await referrer.save();
        
        validatedCount++;
        
        // Emitir notificación
        if (req.io) {
          req.io.to(referrer._id.toString()).emit('referralCompleted', {
            referredUser: referred.username,
            pointsEarned: referral.pointsAwarded
          });
        }
        
        console.log(`✅ Referido validado: ${referred.username} -> ${referrer.username} (+${referral.pointsAwarded} puntos)`);
      } else if (daysSinceRegistration >= 30) {
        // Si han pasado 30 días y no cumple requisitos, cancelar
        referral.status = 'cancelled';
        await referral.save();
        
        cancelledCount++;
        
        console.log(`❌ Referido cancelado por inactividad: ${referred.username} -> ${referrer.username}`);
      }
    }
    
    const response = {
      message: 'Validación de referidos completada',
      validated: validatedCount,
      cancelled: cancelledCount,
      stillPending: pendingReferrals.length - validatedCount - cancelledCount
    };
    
    console.log('📊 Resultado de validación de referidos:', response);
    
    if (res) {
      res.json(response);
    }
    
    return response;
  } catch (err) {
    console.error('Error validating pending referrals:', err);
    if (res) {
      res.status(500).json({ message: 'Error al validar referidos pendientes', error: err.message });
    }
    throw err;
  }
};

/**
 * Endpoint para verificar el estado de un referido específico
 */
exports.checkReferralStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user || !user.referredBy) {
      return res.status(404).json({ message: 'No tienes un referido activo' });
    }
    
    const referral = await Referral.findOne({ referred: userId })
      .populate('referrer', 'username');
    
    if (!referral) {
      return res.status(404).json({ message: 'Referido no encontrado' });
    }
    
    // Calcular progreso
    const daysSinceRegistration = Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    const profileComplete = user.username && user.email;
    
    const Post = require('../models/Post');
    const Reply = require('../models/Reply');
    
    const postCount = await Post.countDocuments({ author: userId });
    const replyCount = await Reply.countDocuments({ author: userId });
    
    const hasMinimumActivity = postCount >= 1 || replyCount >= 3;
    
    res.json({
      status: referral.status,
      referrer: referral.referrer.username,
      pointsToEarn: referral.pointsAwarded,
      requirements: {
        profileComplete: {
          completed: profileComplete,
          description: 'Perfil completo con username y email'
        },
        minimumActivity: {
          completed: hasMinimumActivity,
          description: 'Crear 1 post o 3 comentarios',
          progress: {
            posts: postCount,
            replies: replyCount
          }
        },
        minimumDays: {
          completed: daysSinceRegistration >= 2,
          description: 'Permanecer activo por 2 días',
          progress: {
            current: daysSinceRegistration,
            required: 2
          }
        }
      },
      completedAt: referral.completedAt
    });
  } catch (err) {
    console.error('Error checking referral status:', err);
    res.status(500).json({ message: 'Error al verificar estado del referido', error: err.message });
  }
};

// Actualizar iconos de recompensas (solo Admin)
exports.updateRewardIcons = async (req, res) => {
  try {
    console.log('Updating reward icons...');
    
    // Get all rewards from database
    const existingRewards = await RewardItem.find({});
    console.log(`Found ${existingRewards.length} existing rewards`);
    
    let updatedCount = 0;
    
    // Update each reward with iconUrl based on slug
    for (const reward of existingRewards) {
      const dataReward = rewardsData.find(r => r.slug === reward.slug);
      if (dataReward && dataReward.iconUrl && !reward.iconUrl) {
        reward.iconUrl = dataReward.iconUrl;
        await reward.save();
        updatedCount++;
        console.log(`Updated iconUrl for reward: ${reward.name} -> ${reward.iconUrl}`);
      }
    }
    
    console.log(`Reward icons update completed! Updated ${updatedCount} rewards.`);
    
    res.json({
      message: 'Reward icons update completed',
      totalRewards: existingRewards.length,
      updatedCount: updatedCount
    });
  } catch (error) {
    console.error('Error updating reward icons:', error);
    res.status(500).json({ message: 'Error updating reward icons', error: error.message });
  }
};

module.exports = exports;
