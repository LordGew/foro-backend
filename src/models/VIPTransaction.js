const mongoose = require('mongoose');

const VIPTransactionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  currency: { 
    type: String, 
    default: 'usd',
    uppercase: true
  },
  duration: { 
    type: String, 
    enum: ['bimonthly', 'year', 'lifetime'], 
    required: true 
  },
  stripeSessionId: { 
    type: String,
    unique: true,
    sparse: true
  },
  stripePaymentIntentId: { 
    type: String 
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'refunded'], 
    default: 'pending',
    index: true
  },
  paymentMethod: { 
    type: String,
    default: 'card'
  },
  activatedAt: { 
    type: Date 
  },
  expiresAt: { 
    type: Date 
  },
  refundedAt: { 
    type: Date 
  },
  refundReason: { 
    type: String 
  },
  metadata: {
    ipAddress: String,
    userAgent: String
  }
}, { 
  timestamps: true 
});

VIPTransactionSchema.index({ userId: 1, createdAt: -1 });
VIPTransactionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('VIPTransaction', VIPTransactionSchema);
