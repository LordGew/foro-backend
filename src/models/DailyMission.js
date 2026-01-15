const mongoose = require('mongoose');

const dailyMissionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['create_post', 'create_reply', 'earn_xp', 'unlock_achievement', 'daily_login', 'visit_category'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 200
  },
  icon: {
    type: String,
    default: '🎯'
  },
  requirement: {
    value: {
      type: Number,
      required: true,
      min: 1,
      max: 100
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
      default: 0,
      min: 0
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
  },
  // Nuevo campo para tracking semanal
  weekNumber: {
    type: Number,
    required: true
  },
  // Nuevo campo para evitar duplicados
  hash: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Índices optimizados
dailyMissionSchema.index({ date: 1 });
dailyMissionSchema.index({ expiresAt: 1 });
dailyMissionSchema.index({ type: 1, date: 1 });
dailyMissionSchema.index({ weekNumber: 1 });
dailyMissionSchema.index({ hash: 1 });

// Middleware para generar hash único
dailyMissionSchema.pre('save', function(next) {
  if (!this.hash) {
    // Crear hash basado en tipo, fecha y requisitos
    const hashData = `${this.type}_${this.date.toISOString()}_${this.requirement.value}_${this.requirement.categoryId || 'no-category'}`;
    this.hash = hashData;
  }
  next();
});

// Método estático para encontrar misiones sin duplicados
dailyMissionSchema.statics.findUniqueMissions = async function(date) {
  return this.find({ date })
    .sort({ createdAt: 1 })
    .lean();
};

// Método estático para verificar duplicados semanales
dailyMissionSchema.statics.checkWeeklyDuplicates = async function(missionType, weekNumber) {
  const count = await this.countDocuments({
    type: missionType,
    weekNumber
  });
  return count;
};

// Método para validar integridad
dailyMissionSchema.methods.validateIntegrity = function() {
  const errors = [];
  
  // Validar que expiresAt sea posterior a date
  if (this.expiresAt <= this.date) {
    errors.push('EXPIRACIÓN_ANTES_DE_INICIO');
  }
  
  // Validar que weekNumber corresponda a la fecha
  const expectedWeek = Math.floor((this.date - new Date(this.date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  if (this.weekNumber !== expectedWeek) {
    errors.push('NÚMERO_SEMANA_INCORRECTO');
  }
  
  // Validar que las recompensas sean proporcionales a la dificultad
  const minPoints = {
    easy: 50,
    medium: 100,
    hard: 200
  };
  
  if (this.reward.points < minPoints[this.difficulty]) {
    errors.push('RECOMPENSA_INFERIOR_A_DIFICULTAD');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = mongoose.model('DailyMission', dailyMissionSchema);
