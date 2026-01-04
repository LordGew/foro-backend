const mongoose = require('mongoose');

const moderationActionSchema = new mongoose.Schema({
  // Usuario moderado
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Quién aplica la moderación
  moderator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Tipo de acción
  actionType: {
    type: String,
    enum: ['warning', 'mute', 'suspend', 'ban', 'delete_content', 'restrict'],
    required: true
  },
  
  // Duración (para acciones temporales)
  duration: {
    type: Number, // en días
    default: null
  },
  
  // Fechas
  startsAt: {
    type: Date,
    default: Date.now
  },
  
  endsAt: {
    type: Date,
    default: null
  },
  
  // Estado
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Razón
  reason: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // Reporte relacionado
  relatedReport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    default: null
  },
  
  // Evidencia
  evidence: [{
    type: {
      type: String,
      enum: ['message', 'post', 'comment', 'file', 'screenshot']
    },
    contentId: mongoose.Schema.Types.ObjectId,
    description: String,
    url: String
  }],
  
  // Notificaciones enviadas
  notificationsSent: {
    email: {
      type: Boolean,
      default: false
    },
    inApp: {
      type: Boolean,
      default: false
    },
    sms: {
      type: Boolean,
      default: false
    }
  },
  
  // Historial de cambios
  history: [{
    action: {
      type: String,
      enum: ['created', 'extended', 'reduced', 'lifted', 'modified']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    notes: String
  }]
}, {
  timestamps: true
});

// Índices
moderationActionSchema.index({ targetUser: 1, isActive: 1 });
moderationActionSchema.index({ moderator: 1, createdAt: -1 });
moderationActionSchema.index({ actionType: 1, isActive: 1 });
moderationActionSchema.index({ endsAt: 1, isActive: 1 });

// Middleware para calcular fecha de finalización
moderationActionSchema.pre('save', function() {
  if (this.duration && !this.endsAt) {
    this.endsAt = new Date(this.startsAt.getTime() + (this.duration * 24 * 60 * 60 * 1000));
  }
});

// Métodos de instancia
moderationActionSchema.methods.extend = function(additionalDays, moderatorId, reason = null) {
  const previousEnd = this.endsAt;
  this.endsAt = new Date(this.endsAt.getTime() + (additionalDays * 24 * 60 * 60 * 1000));
  this.duration = Math.ceil((this.endsAt - this.startsAt) / (24 * 60 * 60 * 1000));
  
  this.history.push({
    action: 'extended',
    changedBy: moderatorId,
    previousValue: previousEnd,
    newValue: this.endsAt,
    notes: reason
  });
  
  return this.save();
};

moderationActionSchema.methods.lift = function(moderatorId, reason = null) {
  this.isActive = false;
  this.endsAt = new Date();
  
  this.history.push({
    action: 'lifted',
    changedBy: moderatorId,
    notes: reason
  });
  
  return this.save();
};

moderationActionSchema.methods.isActiveAt = function(date = new Date()) {
  return this.isActive && (!this.endsAt || this.endsAt > date);
};

// Métodos estáticos
moderationActionSchema.statics.getActiveActions = function(userId) {
  return this.find({
    targetUser: userId,
    isActive: true,
    $or: [
      { endsAt: null },
      { endsAt: { $gt: new Date() } }
    ]
  }).populate('moderator', 'username name');
};

moderationActionSchema.statics.getUserStatus = function(userId) {
  return this.aggregate([
    {
      $match: {
        targetUser: mongoose.Types.ObjectId(userId),
        isActive: true,
        $or: [
          { endsAt: null },
          { endsAt: { $gt: new Date() } }
        ]
      }
    },
    {
      $group: {
        _id: '$targetUser',
        activeWarnings: {
          $sum: { $cond: [{ $eq: ['$actionType', 'warning'] }, 1, 0] }
        },
        activeMutes: {
          $sum: { $cond: [{ $eq: ['$actionType', 'mute'] }, 1, 0] }
        },
        activeSuspensions: {
          $sum: { $cond: [{ $eq: ['$actionType', 'suspend'] }, 1, 0] }
        },
        activeBans: {
          $sum: { $cond: [{ $eq: ['$actionType', 'ban'] }, 1, 0] }
        },
        longestEndsAt: { $max: '$endsAt' }
      }
    }
  ]);
};

// Plugin para auto-expirar acciones
moderationActionSchema.statics.expireActions = function() {
  return this.updateMany(
    {
      isActive: true,
      endsAt: { $lt: new Date() }
    },
    {
      $set: { isActive: false }
    }
  );
};

module.exports = mongoose.model('ModerationAction', moderationActionSchema);
