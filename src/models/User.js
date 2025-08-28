// User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Email inválido']
  },
  password: { 
    type: String, 
    required: true,
    minlength: 8
  },
  role: { 
    type: String, 
    enum: ['Player', 'GameMaster', 'Admin'], 
    default: 'Player' 
  },
  xp: { 
    type: Number, 
    default: 0,
    min: 0
  },
  profileImage: { 
    type: String,
    default: null
  },
  bannerImage: { 
    type: String,
    default: null
  },
  bio: { 
    type: String,
    maxlength: 500,
    default: ''
  },
  banned: { 
    type: Boolean, 
    default: false 
  },
  muted: { 
    type: Boolean, 
    default: false 
  },
  banReason: { 
    type: String,
    default: null
  },
  banExpires: { 
    type: Date,
    default: null
  },
  messageRequests: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  contacts: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  mutedChats: [{ 
    type: String 
  }],
  blockedUsers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  moderationHistory: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'XPLog' 
  }],
  postCount: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: Calcular el nivel basado en XP
UserSchema.virtual('level').get(function() {
  // Fórmula: nivel = sqrt(xp / 10) + 1
  return Math.floor(Math.sqrt(this.xp / 10)) + 1;
});

// Virtual: Calcular el rango basado en XP
UserSchema.virtual('rank').get(function() {
  if (this.xp < 50) return 'Novato';
  if (this.xp < 100) return 'Aprendiz';
  if (this.xp < 200) return 'Intermedio';
  if (this.xp < 350) return 'Avanzado';
  if (this.xp < 500) return 'Experto';
  if (this.xp < 750) return 'Maestro';
  return 'Gran Maestro';
});

// Virtual: XP necesaria para el próximo nivel
UserSchema.virtual('nextLevelXp').get(function() {
  return this.level * this.level * 10;
});

// Virtual: Progreso al siguiente nivel (porcentaje)
UserSchema.virtual('progressToNextLevel').get(function() {
  const currentLevelXp = (this.level - 1) * (this.level - 1) * 10;
  const nextLevelXp = this.level * this.level * 10;
  const xpToNextLevel = nextLevelXp - currentLevelXp;
  const xpInCurrentLevel = this.xp - currentLevelXp;
  
  return Math.min(100, Math.round((xpInCurrentLevel / xpToNextLevel) * 100));
});

// Virtual: Total de XP en el nivel actual
UserSchema.virtual('xpInCurrentLevel').get(function() {
  const currentLevelXp = (this.level - 1) * (this.level - 1) * 10;
  return this.xp - currentLevelXp;
});

// Hook: Hash de la contraseña antes de guardar
UserSchema.pre('save', async function(next) {
  // Solo hashear si la contraseña ha sido modificada
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Método: Comparar contraseñas
UserSchema.methods.matchPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Método: Añadir XP
UserSchema.methods.addXp = async function(xp, reason) {
  this.xp += xp;
  
  // Registrar en historial de XP si es necesario
  if (reason) {
    const XPLog = require('./XPLog');
    const xpLog = new XPLog({
      user: this._id,
      xp: xp,
      reason: reason
    });
    await xpLog.save();
  }
  
  return this.save();
};

// Método: Obtener rango
UserSchema.methods.getRank = function() {
  if (this.xp < 50) return 'Novato';
  if (this.xp < 100) return 'Aprendiz';
  if (this.xp < 200) return 'Intermedio';
  if (this.xp < 350) return 'Avanzado';
  if (this.xp < 500) return 'Experto';
  if (this.xp < 750) return 'Maestro';
  return 'Gran Maestro';
};

// Método: Actualizar contadores
UserSchema.methods.updatePostCount = async function(change) {
  this.postCount = Math.max(0, this.postCount + change);
  this.lastLogin = new Date();
  return this.save();
};

UserSchema.methods.updateReplyCount = async function(change) {
  this.replyCount = Math.max(0, this.replyCount + change);
  this.lastLogin = new Date();
  return this.save();
};

// Método: Actualizar última conexión
UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  return this.save();
};

// Índices para búsquedas rápidas
UserSchema.index({ username: 'text', bio: 'text' });
UserSchema.index({ xp: -1 });
UserSchema.index({ role: 1 });

module.exports = mongoose.model('User', UserSchema);