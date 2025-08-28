const mongoose = require('mongoose');

const AdminSettingsSchema = new mongoose.Schema({
  forumName: { type: String, default: 'World of Warcraft Forum' },
  language: { type: String, enum: ['ES', 'EN', 'PT', 'RU', 'FR'], default: 'EN' },
  theme: { type: String, default: 'wow-dark' }, // Ej. para customization
  bannerInterval: { type: Number, default: 5000 }, // ms para auto-slide
}, { timestamps: true });

module.exports = mongoose.model('AdminSettings', AdminSettingsSchema);