const mongoose = require('mongoose');
const slugify = require('slugify');

const rewardItemSchema = new mongoose.Schema({
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['emoji', 'title', 'theme', 'frame'],
    required: true,
    index: true
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  content: {
    type: String,
    required: true
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  previewImage: {
    type: String
  },
  iconUrl: {
    type: String,
    trim: true
  },
  iconHtml: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

rewardItemSchema.index({ type: 1, isActive: 1 });

rewardItemSchema.pre('validate', function handleSlug(next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      trim: true
    });
  }
  next();
});

module.exports = mongoose.model('RewardItem', rewardItemSchema);
