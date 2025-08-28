const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  link: { type: String },
  read: { type: Boolean, default: false },
  type: { 
    type: String, 
    enum: ['follow', 'post', 'reply', 'like', 'mention'], 
    default: 'post' 
  },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  replyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reply' }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);