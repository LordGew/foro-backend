const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  location: { type: String, enum: ['sidebar', 'central'], required: true },
  image_url: { type: String, required: true },
  link_url: { type: String },
  alt_text: { type: String },
  order_index: { type: Number, default: 0 },
  active: { type: Boolean, default: true },

  // Nuevos campos
  display_duration: { type: Number, default: 3 }, // segundos, default 3s
  remaining_shows: { type: Number, default: -1 }  // -1 => ilimitado, 0 => se inactivará al primer registro
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
