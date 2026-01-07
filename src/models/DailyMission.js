const mongoose = require('mongoose');

const dailyMissionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['create_post', 'create_reply', 'earn_xp', 'unlock_achievement', 'daily_login', 'visit_category'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🎯'
  },
  requirement: {
    value: {
      type: Number,
      required: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    }
  },
  reward: {
    points: {
      type: Number,
      required: true,
      min: 50,
      max: 500
    },
    xp: {
      type: Number,
      default: 0
    }
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'easy'
  },
  date: {
    type: Date,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Índices
dailyMissionSchema.index({ date: 1 });
dailyMissionSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('DailyMission', dailyMissionSchema);
