const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  chatRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  fileUrl: {
    type: String,
    default: null
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  },
  reportedCount: {
    type: Number,
    default: 0
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  moderatedAt: {
    type: Date,
    default: null
  },
  moderationReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Índices para mejor rendimiento
chatMessageSchema.index({ chatRoom: 1, createdAt: -1 });
chatMessageSchema.index({ sender: 1, receiver: 1 });
chatMessageSchema.index({ reportedCount: -1 });
chatMessageSchema.index({ isHidden: 1 });

// Middleware para actualizar el último mensaje del chat room
chatMessageSchema.post('save', async function() {
  const ChatRoom = mongoose.model('ChatRoom');
  await ChatRoom.findByIdAndUpdate(this.chatRoom, {
    lastMessage: this._id,
    lastActivity: new Date()
  });
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
