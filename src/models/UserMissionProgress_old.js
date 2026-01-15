const mongoose = require('mongoose');

const userMissionProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  missionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DailyMission',
    required: true
  },
  progress: {
    type: Number,
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  claimed: {
    type: Boolean,
    default: false
  },
  claimedAt: {
    type: Date,
    default: null
  },
  date: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Índices
userMissionProgressSchema.index({ userId: 1, missionId: 1 }, { unique: true });
userMissionProgressSchema.index({ userId: 1, date: 1 });
userMissionProgressSchema.index({ completed: 1, claimed: 1 });

module.exports = mongoose.model('UserMissionProgress', userMissionProgressSchema);
