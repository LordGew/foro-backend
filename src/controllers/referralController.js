const User = require('../models/User');
const Referral = require('../models/Referral');
const RewardItem = require('../models/RewardItem');
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

// Aplicar código de referido al registrarse
exports.applyReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user.userId;
    
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
    
    // Verificar que no exista ya este referido
    const existingReferral = await Referral.findOne({
      referrer: referrer._id,
      referred: userId
    });
    
    if (existingReferral) {
      return res.status(400).json({ message: 'Ya has sido referido por este usuario' });
    }
    
    // Crear referido
    const referral = new Referral({
      referrer: referrer._id,
      referred: userId,
      referralCode: referralCode,
      pointsAwarded: 100,
      status: 'completed',
      completedAt: new Date()
    });
    
    await referral.save();
    
    // Actualizar usuarios
    user.referredBy = referrer._id;
    await user.save();
    
    referrer.totalReferrals += 1;
    referrer.referralPoints += 100;
    await referrer.save();
    
    // Emitir notificación por socket si está disponible
    if (req.io) {
      req.io.to(referrer._id.toString()).emit('referralCompleted', {
        referredUser: user.username,
        pointsEarned: 100
      });
    }
    
    res.json({
      message: 'Código de referido aplicado exitosamente',
      pointsEarned: 100,
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
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const reward = await RewardItem.findById(rewardId);
    if (!reward) {
      return res.status(404).json({ message: 'Recompensa no encontrada' });
    }
    
    // Verificar que el usuario posee la recompensa
    const owned = user.ownedRewards.some(r => r.rewardId.toString() === rewardId);
    if (!owned) {
      return res.status(403).json({ message: 'No posees esta recompensa' });
    }
    
    // Equipar la recompensa según su tipo
    user.activeRewards[reward.type] = reward._id;
    await user.save();
    
    res.json({
      message: 'Recompensa equipada exitosamente',
      activeRewards: user.activeRewards
    });
  } catch (err) {
    console.error('Error equipping reward:', err);
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
    const { name, description, type, cost, content, rarity, previewImage, metadata } = req.body;
    
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

module.exports = exports;
