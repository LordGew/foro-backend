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
  remaining_shows: { type: Number, default: -1 },  // -1 => ilimitado, 0 => se inactivará al primer registro

  // Campos de texto superpuesto
  text: { type: String, default: '' },
  text_position: { type: String, default: 'center' },
  text_color: { type: String, default: '#ffffff' },
  text_font_size: { type: String, default: 'large' },
  text_font_weight: { type: String, default: 'bold' },
  text_background_color: { type: String, default: '#000000' },
  text_opacity: { type: Number, default: 0.8 },
  text_padding: { type: Number, default: 20 },
  text_border_radius: { type: Number, default: 10 }
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
