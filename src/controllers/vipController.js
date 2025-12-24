const VIPTransaction = require('../models/VIPTransaction');
const VIPBenefit = require('../models/VIPBenefit');
const User = require('../models/User');
const mongoose = require('mongoose');

const getVipTransactions = async (req, res) => {
  try {
    const transactions = await VIPTransaction.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json(transactions);
  } catch (error) {
    console.error('Error al obtener transacciones VIP:', error);
    res.status(500).json({ error: 'Error al cargar historial de transacciones' });
  }
};

const createVipTransaction = async (userId, amount, currency, duration, sessionId) => {
  try {
    const transaction = new VIPTransaction({
      userId,
      amount,
      currency,
      duration,
      stripeSessionId: sessionId,
      status: 'pending'
    });
    
    await transaction.save();
    return transaction;
  } catch (error) {
    console.error('Error al crear transacción VIP:', error);
    throw error;
  }
};

const completeVipTransaction = async (sessionId, paymentIntentId) => {
  try {
    const transaction = await VIPTransaction.findOne({ stripeSessionId: sessionId });
    
    if (!transaction) {
      throw new Error('Transacción no encontrada');
    }
    
    let expiresAt;
    switch (transaction.duration) {
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
    
    transaction.status = 'completed';
    transaction.activatedAt = new Date();
    transaction.expiresAt = expiresAt;
    transaction.stripePaymentIntentId = paymentIntentId;
    await transaction.save();
    
    const user = await User.findById(transaction.userId);
    if (user) {
      user.vip = true;
      user.vipExpiresAt = expiresAt;
      user.vipTier = transaction.duration === 'lifetime' ? 'lifetime' : 'premium';
      
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
    }
    
    return transaction;
  } catch (error) {
    console.error('Error al completar transacción VIP:', error);
    throw error;
  }
};

const getVipBenefits = async (req, res) => {
  try {
    const benefits = await VIPBenefit.findOne({ userId: req.user.userId });
    
    if (!benefits) {
      return res.status(404).json({ error: 'No se encontraron beneficios VIP' });
    }
    
    res.json(benefits);
  } catch (error) {
    console.error('Error al obtener beneficios VIP:', error);
    res.status(500).json({ error: 'Error al cargar beneficios VIP' });
  }
};

const updateVipBenefits = async (req, res) => {
  try {
    const { customColor, customBadge, theme } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user || !user.vip) {
      return res.status(403).json({ error: 'Necesitas ser VIP para personalizar beneficios' });
    }
    
    let benefits = await VIPBenefit.findOne({ userId: req.user.userId });
    
    if (!benefits) {
      benefits = new VIPBenefit({ userId: req.user.userId });
    }
    
    if (customColor) benefits.customColor = customColor;
    if (customBadge) benefits.customBadge = customBadge;
    if (theme) benefits.theme = theme;
    
    await benefits.save();
    
    res.json({ message: 'Beneficios actualizados', benefits });
  } catch (error) {
    console.error('Error al actualizar beneficios VIP:', error);
    res.status(500).json({ error: 'Error al actualizar beneficios' });
  }
};

module.exports = {
  getVipTransactions,
  createVipTransaction,
  completeVipTransaction,
  getVipBenefits,
  updateVipBenefits
};
