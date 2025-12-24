const mongoose = require('mongoose');

const rewardItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['emoji', 'title', 'theme', 'frame'],
    required: true,
    index: true
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  content: {
    type: String,
    required: true
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  previewImage: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

rewardItemSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('RewardItem', rewardItemSchema);
