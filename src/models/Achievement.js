const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🏆'
  },
  category: {
    type: String,
    enum: ['level', 'posts', 'replies', 'likes', 'referrals', 'special'],
    required: true
  },
  requirement: {
    type: {
      type: String,
      enum: ['xp', 'posts', 'replies', 'likes', 'referrals', 'special'],
      required: true
    },
    value: {
      type: Number,
      required: true
    }
  },
  reward: {
    type: {
      type: String,
      enum: ['emoji', 'title', 'theme', 'frame', 'points'],
      default: 'points'
    },
    rewardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardItem'
    },
    points: {
      type: Number,
      default: 0
    }
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  points: {
    type: Number,
    default: 10
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Achievement', achievementSchema);
