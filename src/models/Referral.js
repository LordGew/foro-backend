const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  referred: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  referralCode: {
    type: String,
    required: true,
    index: true
  },
  pointsAwarded: {
    type: Number,
    default: 100
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Índice compuesto para evitar referidos duplicados
referralSchema.index({ referrer: 1, referred: 1 }, { unique: true });

module.exports = mongoose.model('Referral', referralSchema);
