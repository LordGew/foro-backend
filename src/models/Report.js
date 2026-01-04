const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // Quién reporta
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Qué se reporta
  targetType: {
    type: String,
    enum: ['user', 'message', 'post', 'comment', 'chatRoom'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Razón del reporte
  category: {
    type: String,
    enum: [
      'spam', 'harassment', 'hate_speech', 'violence', 'adult_content',
      'misinformation', 'copyright', 'impersonation', 'self_harm', 'threats',
      'privacy_violation', 'inappropriate_behavior', 'scam', 'other'
    ],
    required: true
  },
  
  description: {
    type: String,
    maxlength: 500,
    required: true,
    trim: true
  },
  
  // Estado del reporte
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed', 'escalated'],
    default: 'pending'
  },
  
  // Moderación
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  reviewedAt: {
    type: Date,
    default: null
  },
  
  reviewNotes: {
    type: String,
    maxlength: 1000,
    default: null
  },
  
  // Acciones tomadas
  actionsTaken: [{
    type: {
      type: String,
      enum: ['warning', 'mute', 'suspend', 'ban', 'delete_content', 'hide_content', 'escalate']
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    duration: {
      type: Number, // en días, para suspensiones/temporales
      default: null
    },
    reason: {
      type: String,
      maxlength: 500
    }
  }],
  
  // Evidencia adicional
  evidence: [{
    type: {
      type: String,
      enum: ['screenshot', 'file', 'link', 'text']
    },
    content: String,
    url: String,
    description: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Prioridad
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Seguimiento
  followUpRequired: {
    type: Boolean,
    default: false
  },
  
  followUpDate: {
    type: Date,
    default: null
  },
  
  // Estadísticas
  previousReports: {
    type: Number,
    default: 0
  },
  
  severity: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  }
}, {
  timestamps: true
});

// Índices
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1, status: 1 });
reportSchema.index({ status: 1, priority: -1, createdAt: -1 });
reportSchema.index({ reviewedBy: 1, reviewedAt: -1 });
reportSchema.index({ category: 1, status: 1 });

// Middleware para actualizar contadores de reportes
reportSchema.pre('save', async function() {
  if (this.isNew) {
    // Actualizar contador de reportes previos
    const previousReports = await this.constructor.countDocuments({
      targetType: this.targetType,
      targetId: this.targetId,
      status: { $ne: 'dismissed' }
    });
    this.previousReports = previousReports;
    
    // Ajustar prioridad basada en reportes previos
    if (previousReports >= 5) {
      this.priority = 'high';
    } else if (previousReports >= 10) {
      this.priority = 'critical';
    }
    
    // Actualizar el objeto reportado
    await this.updateTargetReportCount();
  }
});

reportSchema.post('save', async function() {
  // Notificar a administradores si es prioridad alta o crítica
  if (this.priority === 'high' || this.priority === 'critical') {
    const User = mongoose.model('User');
    const admins = await User.find({ role: { $in: ['admin', 'moderator'] } });
    
    // Emitir notificación vía Socket.IO si está disponible
    if (global.io) {
      admins.forEach(admin => {
        global.io.emit(`admin:${admin._id}:new_report`, {
          reportId: this._id,
          type: this.targetType,
          priority: this.priority,
          category: this.category
        });
      });
    }
  }
});

// Métodos de instancia
reportSchema.methods.updateTargetReportCount = async function() {
  let Model;
  
  switch (this.targetType) {
    case 'user':
      Model = mongoose.model('User');
      break;
    case 'message':
      Model = mongoose.model('ChatMessage');
      break;
    case 'post':
      Model = mongoose.model('Post');
      break;
    case 'comment':
      Model = mongoose.model('Comment');
      break;
    case 'chatRoom':
      Model = mongoose.model('ChatRoom');
      break;
  }
  
  if (Model) {
    await Model.findByIdAndUpdate(this.targetId, {
      $inc: { reportedCount: 1 }
    });
  }
};

reportSchema.methods.addAction = function(action, appliedBy, duration = null, reason = null) {
  this.actionsTaken.push({
    type: action,
    appliedBy,
    duration,
    reason
  });
  return this.save();
};

reportSchema.methods.resolve = function(adminId, notes = null) {
  this.status = 'resolved';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  if (notes) this.reviewNotes = notes;
  return this.save();
};

reportSchema.methods.dismiss = function(adminId, notes = null) {
  this.status = 'dismissed';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  if (notes) this.reviewNotes = notes;
  return this.save();
};

// Métodos estáticos
reportSchema.statics.getPendingReports = function(page = 1, limit = 20) {
  return this.find({ status: 'pending' })
    .populate('reporter', 'username name avatar')
    .populate('reviewedBy', 'username name')
    .sort({ priority: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

reportSchema.statics.getReportsByTarget = function(targetType, targetId) {
  return this.find({ targetType, targetId })
    .populate('reporter', 'username name avatar')
    .populate('reviewedBy', 'username name')
    .sort({ createdAt: -1 });
};

reportSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        byStatus: {
          $push: {
            status: '$_id',
            count: '$count'
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Report', reportSchema);
