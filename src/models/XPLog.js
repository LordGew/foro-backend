const mongoose = require('mongoose');

const XPLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'post_created', 'banned'
  xpChange: { type: Number, default: 0 },
  moderator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revertible: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('XPLog', XPLogSchema);