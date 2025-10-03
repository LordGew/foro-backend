const mongoose = require('mongoose');
const slugify = require('slugify');

const CategorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true,
  },
}, { timestamps: true });

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