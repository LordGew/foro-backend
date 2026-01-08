const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Reply = require('../models/Reply');
const Category = require('../models/Category');
const { sanitizeContent } = require('../utils/sanitize');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const slugify = require('slugify');
const { checkAndGrantAchievements, checkSpecialAchievement } = require('../utils/achievementChecker');

// Role hierarchy ranks (higher number = higher rank)
const roleRanks = {
  'Player': 0,
  'GameMaster': 1,
  'Admin': 2
};

// Helper to check if actor can moderate target
const canModerate = (actorRole, targetRole) => {
  const actorRank = roleRanks[actorRole] || 0;
  const targetRank = roleRanks[targetRole] || 0;
  return actorRank > targetRank;
};

// Función para añadir XP por crear un post
const addPostXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 10 } }, { runValidators: false });
    console.log(`+10 XP a usuario por crear post (ID: ${userId})`);
  } catch (err) {
    console.error('Error al añadir XP por post:', err.message);
  }
};

// Función para añadir XP por recibir un like
const addLikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 2 } }, { runValidators: false });
    console.log(`+2 XP a usuario por recibir like (ID: ${userId})`);
  } catch (err) {
    console.error('Error al añadir XP por like:', err.message);
  }
};

// Función para quitar XP por quitar un like
const removeLikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: -1 } }, { runValidators: false });
    console.log(`-1 XP a usuario por quitar like (ID: ${userId})`);
  } catch (err) {
    console.error('Error al quitar XP por like:', err.message);
  }
};

// Función para añadir XP por recibir un dislike
const addDislikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: -1 } }, { runValidators: false });
    console.log(`-1 XP a usuario por recibir dislike (ID: ${userId})`);
  } catch (err) {
    console.error('Error al añadir XP por dislike:', err.message);
  }
};

// Función para quitar XP por quitar un dislike
const removeDislikeXp = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    await User.findByIdAndUpdate(userId, { $inc: { xp: 1 } }, { runValidators: false });
    console.log(`+1 XP a usuario por quitar dislike (ID: ${userId})`);
  } catch (err) {
    console.error('Error al quitar XP por dislike:', err.message);
  }
};

const createPost = async (req, res) => {
  try {
    const { title, content, category } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({
        message: 'Faltan campos requeridos',
        required: ['title', 'content', 'category']
      });
    }

    const sanitizedContent = sanitizeContent(content);
    let slug = slugify(title, { lower: true, strict: true });

    let existingPost = await Post.findOne({ slug });
    let counter = 1;
    while (existingPost) {
      slug = `${slugify(title, { lower: true, strict: true })}-${counter}`;
      existingPost = await Post.findOne({ slug });
      counter++;
    }

    const post = new Post({
      title,
      content: sanitizedContent,
      category,
      author: req.user.userId,
      slug
    });

    if (req.file) {
      post.images = [req.file.path];
    }

    await post.save();

    await User.updateOne(
      { _id: req.user.userId },
      { 
        $inc: { 
          postCount: 1,
          xp: 10
        },
        lastLogin: new Date()
      },
      { runValidators: true }
    );

    console.log(`Post creado y counters actualizados para usuario ${req.user.userId}`);

    const { updateMissionProgress } = require('./missionController');
    await updateMissionProgress(req.user.userId, 'create_post', 1, category);

    const postHour = new Date().getHours();
    if (postHour < 6) {
      await checkSpecialAchievement(req.user.userId, 'early_bird');
    } else if (postHour >= 0 && postHour < 3) {
      await checkSpecialAchievement(req.user.userId, 'night_owl');
    }

    await checkAndGrantAchievements(req.user.userId, 'post_created');

    res.status(201).json(post);
  } catch (err) {
    console.error('Error al crear post:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(err => err.message);
      return res.status(400).json({ message: 'Error de validación', errors: messages });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'La imagen no debe superar los 5MB' });
    }
    if (err.message && err.message.includes('Solo se permiten imágenes')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

module.exports = {
  createPost,
  addPostXp,
  addLikeXp,
  removeLikeXp,
  addDislikeXp,
  removeDislikeXp,
  canModerate
};
