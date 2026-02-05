const mongoose = require('mongoose');

const vipRewardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['theme', 'frame', 'title', 'badge'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '👑'
  },
  rarity: {
    type: String,
    enum: ['rare', 'epic', 'legendary'],
    default: 'rare'
  },
  previewImage: {
    type: String,
    default: null
  },
  // Tier de desbloqueo VIP
  // 1 = 1 mes, 2 = 3 meses, 3 = 6 meses, 4 = 12 meses, 5 = vitalicio
  requiredTier: {
    type: Number,
    enum: [1, 2, 3, 4, 5],
    required: true
  },
  requiredMonths: {
    type: Number,
    required: true
  },
  // Referencia al RewardItem creado (para equipar)
  rewardItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RewardItem',
    default: null
  },
  // Para badges VIP, referencia al Badge
  badgeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge',
    default: null
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

vipRewardSchema.index({ type: 1, requiredTier: 1 });
vipRewardSchema.index({ requiredMonths: 1 });

module.exports = mongoose.model('VipReward', vipRewardSchema);
