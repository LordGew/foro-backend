const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['title', 'emoji', 'theme', 'frame'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  icon: {
    type: String,
    default: '🏷️'
  },
  isAvailable: {
    type: Boolean,
    default: true
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
  }
}, {
  timestamps: true
});

// Índices
shopItemSchema.index({ type: 1, isAvailable: 1 });
shopItemSchema.index({ price: 1 });
shopItemSchema.index({ rarity: 1 });

module.exports = mongoose.model('ShopItem', shopItemSchema);
