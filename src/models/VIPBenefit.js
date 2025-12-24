const mongoose = require('mongoose');

const VIPBenefitSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  customColor: { 
    type: String, 
    default: '#FFD700',
    validate: {
      validator: function(v) {
        return /^#[0-9A-F]{6}$/i.test(v);
      },
      message: 'Color must be a valid hex color'
    }
  },
  customBadge: { 
    type: String, 
    default: 'VIP',
    maxlength: 20
  },
  xpMultiplier: { 
    type: Number, 
    default: 1.5,
    min: 1,
    max: 3
  },
  theme: { 
    type: String, 
    enum: ['light', 'dark', 'auto'], 
    default: 'auto' 
  },
  customEmojis: [{
    name: { type: String, required: true },
    url: { type: String, required: true }
  }],
  features: {
    unlimitedMessages: { type: Boolean, default: true },
    prioritySupport: { type: Boolean, default: true },
    noRateLimit: { type: Boolean, default: true },
    customBanner: { type: Boolean, default: true }
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('VIPBenefit', VIPBenefitSchema);
