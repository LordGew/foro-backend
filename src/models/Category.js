const mongoose = require('mongoose');
const slugify = require('slugify');

const CategorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  slug: {
    type: String,
    lowercase: true,
    index: true,
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '📁'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Índice compuesto: nombre único por juego
CategorySchema.index({ name: 1, game: 1 }, { unique: true });
CategorySchema.index({ slug: 1, game: 1 }, { unique: true });

// Generar slug antes de guardar
CategorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Generar slug antes de actualizar
CategorySchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('Category', CategorySchema);