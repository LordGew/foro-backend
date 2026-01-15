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
    default: 0,
    min: 0
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
  },
  // Nuevo campo para tracking de integridad
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  // Nuevo campo para detectar anomalías
  updateCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Índices optimizados
userMissionProgressSchema.index({ userId: 1, missionId: 1, date: 1 }, { unique: true });
userMissionProgressSchema.index({ userId: 1, date: 1 });
userMissionProgressSchema.index({ completed: 1, claimed: 1 });
userMissionProgressSchema.index({ date: 1 });

// Middleware para validar integridad
userMissionProgressSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  this.updateCount = (this.updateCount || 0) + 1;
  
  // Validar que el progreso no sea negativo
  if (this.progress < 0) {
    this.progress = 0;
  }
  
  // Validar consistencia entre completed y progress
  if (this.completed && this.progress === 0) {
    this.completed = false;
    this.completedAt = null;
  }
  
  next();
});

// Método para validar integridad
userMissionProgressSchema.methods.validateIntegrity = function() {
  const errors = [];
  
  // Validar que claimed solo sea true si completed es true
  if (this.claimed && !this.completed) {
    errors.push('RECOMPENSA_RECLAMADA_SIN_COMPLETAR');
  }
  
  // Validar que completedAt exista si completed es true
  if (this.completed && !this.completedAt) {
    errors.push('COMPLETADO_SIN_FECHA');
  }
  
  // Validar que claimedAt exista si claimed es true
  if (this.claimed && !this.claimedAt) {
    errors.push('RECLAMADO_SIN_FECHA');
  }
  
  // Validar que las fechas sean lógicas
  if (this.completedAt && this.claimedAt) {
    if (this.claimedAt < this.completedAt) {
      errors.push('RECLAMADO_ANTES_DE_COMPLETAR');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Método estático para encontrar progreso con validación
userMissionProgressSchema.statics.findWithValidation = async function(query) {
  const progress = await this.findOne(query);
  if (progress) {
    const validation = progress.validateIntegrity();
    if (!validation.isValid) {
      console.warn('⚠️ PROGRESO CON ERRORES DE INTEGRIDAD:', {
        progressId: progress._id,
        errors: validation.errors
      });
    }
  }
  return progress;
};

module.exports = mongoose.model('UserMissionProgress', userMissionProgressSchema);
