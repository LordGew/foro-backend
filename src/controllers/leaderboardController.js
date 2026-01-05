const User = require('../models/User');

/**
 * Obtener leaderboard de puntos de logros
 */
exports.getAchievementLeaderboard = async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const leaderboard = await User.find({ achievementPoints: { $gt: 0 } })
      .select('username profileImage achievementPoints achievements xp level rank')
      .populate('achievements.achievementId', 'name icon rarity')
      .sort({ achievementPoints: -1, achievements: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Agregar posición en el ranking
    const leaderboardWithRank = leaderboard.map((user, index) => ({
      ...user,
      rank: skip + index + 1,
      achievementCount: user.achievements?.length || 0
    }));

    // Obtener total de usuarios con logros
    const totalUsers = await User.countDocuments({ achievementPoints: { $gt: 0 } });

    res.json({
      leaderboard: leaderboardWithRank,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (err) {
    console.error('Error getting achievement leaderboard:', err);
    res.status(500).json({ message: 'Error al obtener leaderboard', error: err.message });
  }
};

/**
 * Obtener leaderboard de XP
 */
exports.getXpLeaderboard = async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const leaderboard = await User.find({ xp: { $gt: 0 } })
      .select('username profileImage xp level rank postCount replyCount')
      .sort({ xp: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Agregar posición en el ranking
    const leaderboardWithRank = leaderboard.map((user, index) => ({
      ...user,
      rank: skip + index + 1
    }));

    const totalUsers = await User.countDocuments({ xp: { $gt: 0 } });

    res.json({
      leaderboard: leaderboardWithRank,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (err) {
    console.error('Error getting XP leaderboard:', err);
    res.status(500).json({ message: 'Error al obtener leaderboard', error: err.message });
  }
};

/**
 * Obtener leaderboard de posts
 */
exports.getPostsLeaderboard = async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const leaderboard = await User.find({ postCount: { $gt: 0 } })
      .select('username profileImage postCount replyCount xp')
      .sort({ postCount: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const leaderboardWithRank = leaderboard.map((user, index) => ({
      ...user,
      rank: skip + index + 1
    }));

    const totalUsers = await User.countDocuments({ postCount: { $gt: 0 } });

    res.json({
      leaderboard: leaderboardWithRank,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (err) {
    console.error('Error getting posts leaderboard:', err);
    res.status(500).json({ message: 'Error al obtener leaderboard', error: err.message });
  }
};

/**
 * Obtener leaderboard de referidos
 */
exports.getReferralsLeaderboard = async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const leaderboard = await User.find({ totalReferrals: { $gt: 0 } })
      .select('username profileImage totalReferrals referralPoints')
      .sort({ totalReferrals: -1, referralPoints: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const leaderboardWithRank = leaderboard.map((user, index) => ({
      ...user,
      rank: skip + index + 1
    }));

    const totalUsers = await User.countDocuments({ totalReferrals: { $gt: 0 } });

    res.json({
      leaderboard: leaderboardWithRank,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (err) {
    console.error('Error getting referrals leaderboard:', err);
    res.status(500).json({ message: 'Error al obtener leaderboard', error: err.message });
  }
};

/**
 * Obtener posición del usuario en el leaderboard
 */
exports.getMyRank = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type = 'achievements' } = req.query;

    const user = await User.findById(userId)
      .select('username achievementPoints xp postCount totalReferrals');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    let rank = 0;
    let total = 0;

    switch (type) {
      case 'achievements':
        rank = await User.countDocuments({
          achievementPoints: { $gt: user.achievementPoints }
        }) + 1;
        total = await User.countDocuments({ achievementPoints: { $gt: 0 } });
        break;
      case 'xp':
        rank = await User.countDocuments({
          xp: { $gt: user.xp }
        }) + 1;
        total = await User.countDocuments({ xp: { $gt: 0 } });
        break;
      case 'posts':
        rank = await User.countDocuments({
          postCount: { $gt: user.postCount }
        }) + 1;
        total = await User.countDocuments({ postCount: { $gt: 0 } });
        break;
      case 'referrals':
        rank = await User.countDocuments({
          totalReferrals: { $gt: user.totalReferrals }
        }) + 1;
        total = await User.countDocuments({ totalReferrals: { $gt: 0 } });
        break;
      default:
        return res.status(400).json({ message: 'Tipo de leaderboard inválido' });
    }

    res.json({
      rank,
      total,
      percentile: total > 0 ? Math.round((1 - (rank / total)) * 100) : 0,
      user: {
        username: user.username,
        achievementPoints: user.achievementPoints,
        xp: user.xp,
        postCount: user.postCount,
        totalReferrals: user.totalReferrals
      }
    });
  } catch (err) {
    console.error('Error getting user rank:', err);
    res.status(500).json({ message: 'Error al obtener ranking', error: err.message });
  }
};
