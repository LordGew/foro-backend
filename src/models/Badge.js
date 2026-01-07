const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
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
  icon: {
    type: String,
    required: true,
    default: '🎖️'
  },
  category: {
    type: String,
    enum: ['military', 'explorer', 'special', 'legendary', 'event'],
    required: true
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  requiredLevel: {
    type: Number,
    default: 1
  },
  requiredAchievement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    default: null
  },
  stock: {
    type: Number,
    default: -1 // -1 = ilimitado
  },
  purchaseCount: {
    type: Number,
    default: 0
  },
  available: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
badgeSchema.index({ category: 1, rarity: 1 });
badgeSchema.index({ price: 1 });
badgeSchema.index({ available: 1 });

module.exports = mongoose.model('Badge', badgeSchema);
