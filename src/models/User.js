const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

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
    maxlength: 2000,
    default: ''
  },
  bioFormat: {
    type: String,
    enum: ['plain', 'markdown'],
    default: 'plain'
  },
  socialLinks: {
    twitter: { type: String, maxlength: 100 },
    discord: { type: String, maxlength: 100 },
    youtube: { type: String, maxlength: 200 },
    twitch: { type: String, maxlength: 100 },
    github: { type: String, maxlength: 100 },
    website: { type: String, maxlength: 200 }
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
  blockedBy: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  reportedChats: [{
    chatId: { type: String, required: true },
    reason: { type: String, default: 'inappropriate' },
    reportedAt: { type: Date, default: Date.now }
  }],
  moderationHistory: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'XPLog' 
  }],
  postCount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  replyCount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  isOnline: { 
    type: Boolean, 
    default: false 
  },
  lastLogin: { 
    type: Date, 
    default: Date.now 
  },
  vip: { 
    type: Boolean, 
    default: false 
  },
  vipExpiresAt: { 
    type: Date, 
    default: null 
  },
  vipTier: { 
    type: String, 
    enum: ['none', 'basic', 'premium', 'lifetime'], 
    default: 'none' 
  },
  vipBenefits: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'VIPBenefit' 
  },
  resetPasswordToken: { 
    type: String 
  },
  resetPasswordExpires: { 
    type: Date 
  },
  // Juego preferido del usuario
  preferredGame: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null
  },
  hasSelectedGame: {
    type: Boolean,
    default: false
  },
  // Sistema de Puntos de Referidos
  referralPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  totalReferrals: {
    type: Number,
    default: 0,
    min: 0
  },
  // Recompensas adquiridas
  ownedRewards: [{
    rewardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardItem',
      required: true
    },
    purchasedAt: {
      type: Date,
      default: Date.now
    }
  }],
  activeRewards: {
    emoji: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardItem',
      default: null
    },
    title: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardItem',
      default: null
    },
    theme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardItem',
      default: null
    },
    frame: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardItem',
      default: null
    }
  }
},
{
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: Calcular el nivel basado en XP
UserSchema.virtual('level').get(function() {
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

// Transformar toJSON para agregar baseUrl a profileImage
UserSchema.options.toJSON = {
  transform: function(doc, ret) {
    if (ret.profileImage) {
      ret.profileImage = `${baseUrl}/uploads/profiles/${ret.profileImage}`;
    }
    if (ret.bannerImage) {
      ret.bannerImage = `${baseUrl}/uploads/banners/${ret.bannerImage}`;
    }
    return ret;
  }
};

// Hook: Hash de la contraseña antes de guardar
UserSchema.pre('save', async function(next) {
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
  if (xp < 0) throw new Error('XP cannot be negative');
  this.xp += xp;
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

// 🛡️ Métodos de Moderación
UserSchema.methods.isBannedOrSuspended = function() {
  const now = new Date();
  return (
    this.isBanned || 
    (this.bannedUntil && this.bannedUntil > now) ||
    this.isSuspended ||
    (this.suspendedUntil && this.suspendedUntil > now)
  );
};

UserSchema.methods.hasRestriction = function(type) {
  const restriction = this.restrictions?.find(r => r.type === type);
  if (!restriction) return false;
  return !restriction.until || restriction.until > new Date();
};

UserSchema.methods.addWarning = function(reason, moderatorId) {
  this.warningCount += 1;
  this.lastWarningAt = new Date();
  this.moderationNotes = `Warning: ${reason}`;
  return this.save();
};

UserSchema.methods.ban = function(duration, reason, moderatorId) {
  this.isBanned = true;
  this.bannedUntil = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;
  this.banReason = reason;
  this.status = 'banned';
  return this.save();
};

UserSchema.methods.suspend = function(duration, reason, moderatorId) {
  this.isSuspended = true;
  this.suspendedUntil = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;
  this.suspensionReason = reason;
  this.status = 'suspended';
  return this.save();
};

UserSchema.methods.liftBan = function() {
  this.isBanned = false;
  this.bannedUntil = null;
  this.banReason = null;
  this.status = 'active';
  return this.save();
};

UserSchema.methods.liftSuspension = function() {
  this.isSuspended = false;
  this.suspendedUntil = null;
  this.suspensionReason = null;
  this.status = 'active';
  return this.save();
};

UserSchema.methods.addRestriction = function(type, duration, reason) {
  // Eliminar restricción existente del mismo tipo
  this.restrictions = this.restrictions?.filter(r => r.type !== type) || [];
  
  // Agregar nueva restricción
  this.restrictions.push({
    type,
    until: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null,
    reason
  });
  
  if (!this.isRestricted) {
    this.isRestricted = true;
    this.status = 'restricted';
  }
  
  return this.save();
};

UserSchema.methods.removeRestriction = function(type) {
  this.restrictions = this.restrictions?.filter(r => r.type !== type) || [];
  
  if (this.restrictions.length === 0) {
    this.isRestricted = false;
    this.status = 'active';
  }
  
  return this.save();
};

// Índices para búsquedas rápidas
UserSchema.index({ username: 'text', bio: 'text' });
UserSchema.index({ xp: -1 });
UserSchema.index({ role: 1 });
UserSchema.index({ 'mutedChats': 1 });
UserSchema.index({ 'blockedUsers': 1 });
UserSchema.index({ 'reportedChats.chatId': 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ isBanned: 1 });
UserSchema.index({ isSuspended: 1 });
UserSchema.index({ bannedUntil: 1 });
UserSchema.index({ suspendedUntil: 1 });

module.exports = mongoose.model('User', UserSchema);