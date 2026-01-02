const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Estados de moderación por participante
  blockedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  mutedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Índice compuesto para búsquedas rápidas
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Método para encontrar conversación entre dos usuarios
conversationSchema.statics.findBetweenUsers = async function(userId1, userId2) {
  return this.findOne({
    participants: { $all: [userId1, userId2], $size: 2 }
  }).populate('participants', 'username avatar profileImage')
    .populate('lastMessage');
};

module.exports = mongoose.model('Conversation', conversationSchema);
