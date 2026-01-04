const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastReadAt: {
      type: Date,
      default: Date.now
    },
    isMuted: {
      type: Boolean,
      default: false
    },
    mutedUntil: {
      type: Date,
      default: null
    }
  }],
  type: {
    type: String,
    enum: ['private', 'group'],
    default: 'private'
  },
  name: {
    type: String,
    maxlength: 50,
    trim: true
  },
  description: {
    type: String,
    maxlength: 200,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage',
    default: null
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  },
  settings: {
    allowFileSharing: {
      type: Boolean,
      default: true
    },
    allowImageSharing: {
      type: Boolean,
      default: true
    },
    maxFileSize: {
      type: Number,
      default: 10485760 // 10MB
    },
    autoDeleteMessages: {
      type: Boolean,
      default: false
    },
    messageRetentionDays: {
      type: Number,
      default: 30
    }
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

// Índices
chatRoomSchema.index({ 'participants.user': 1 });
chatRoomSchema.index({ createdBy: 1 });
chatRoomSchema.index({ lastActivity: -1 });
chatRoomSchema.index({ isActive: 1, isArchived: 1 });

// Métodos estáticos
chatRoomSchema.statics.findPrivateChat = function(user1Id, user2Id) {
  return this.findOne({
    type: 'private',
    'participants.user': { $all: [user1Id, user2Id] },
    isActive: true
  }).populate('participants.user', 'username name avatar');
};

chatRoomSchema.statics.getUserChats = function(userId, page = 1, limit = 20) {
  return this.find({
    'participants.user': userId,
    isActive: true,
    isArchived: false
  })
  .populate('participants.user', 'username name avatar role')
  .populate('lastMessage')
  .sort({ lastActivity: -1 })
  .skip((page - 1) * limit)
  .limit(limit);
};

// Métodos de instancia
chatRoomSchema.methods.addParticipant = function(userId) {
  const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
  if (!existingParticipant) {
    this.participants.push({ user: userId });
    return this.save();
  }
  return Promise.resolve(this);
};

chatRoomSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(p => p.user.toString() !== userId.toString());
  
  // Si es un chat privado y queda un solo participante, archivar
  if (this.type === 'private' && this.participants.length <= 1) {
    this.isArchived = true;
    this.archivedAt = new Date();
  }
  
  return this.save();
};

chatRoomSchema.methods.markAsRead = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.lastReadAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

chatRoomSchema.methods.muteParticipant = function(userId, duration = null) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.isMuted = true;
    participant.mutedUntil = duration ? new Date(Date.now() + duration) : null;
    return this.save();
  }
  return Promise.resolve(this);
};

chatRoomSchema.methods.unmuteParticipant = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.isMuted = false;
    participant.mutedUntil = null;
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
