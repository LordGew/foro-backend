// Reply.js
const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  content: { type: String, required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  parentReply: { type: mongoose.Schema.Types.ObjectId, ref: 'Reply' },
  quote: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Reply', ReplySchema);