const Achievement = require('../models/Achievement');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Verifica y otorga logros al usuario basado en su progreso actual
 * @param {String} userId - ID del usuario
 * @param {String} actionType - Tipo de acción realizada (opcional)
 */
async function checkAndGrantAchievements(userId, actionType = null) {
  try {
    const user = await User.findById(userId).populate('achievements.achievementId');
    if (!user) return;

    // Obtener todos los logros activos
    const allAchievements = await Achievement.find({ isActive: true });

    // Filtrar logros que el usuario aún no ha desbloqueado
    const unlockedAchievementIds = user.achievements
      .filter(a => a.unlockedAt)
      .map(a => a.achievementId._id.toString());

    const achievementsToCheck = allAchievements.filter(
      achievement => !unlockedAchievementIds.includes(achievement._id.toString())
    );

    let newAchievements = [];

    for (const achievement of achievementsToCheck) {
      let progress = 0;
      let isCompleted = false;

      switch (achievement.requirement.type) {
        case 'xp':
          progress = user.xp || 0;
          isCompleted = progress >= achievement.requirement.value;
          break;

        case 'posts':
          progress = user.postCount || 0;
          isCompleted = progress >= achievement.requirement.value;
          break;

        case 'replies':
          progress = user.replyCount || 0;
          isCompleted = progress >= achievement.requirement.value;
          break;

        case 'referrals':
          progress = user.totalReferrals || 0;
          isCompleted = progress >= achievement.requirement.value;
          break;

        case 'special':
          // Los logros especiales se manejan de forma específica
          progress = 0;
          isCompleted = false;
          break;
      }

      // Actualizar progreso del logro
      const existingAchievement = user.achievements.find(
        a => a.achievementId._id.toString() === achievement._id.toString()
      );

      if (existingAchievement) {
        existingAchievement.progress = progress;
      } else {
        user.achievements.push({
          achievementId: achievement._id,
          progress: progress,
          unlockedAt: null
        });
      }

      // Si el logro está completado, desbloquearlo
      if (isCompleted) {
        const achievementIndex = user.achievements.findIndex(
          a => a.achievementId._id.toString() === achievement._id.toString()
        );

        if (achievementIndex !== -1 && !user.achievements[achievementIndex].unlockedAt) {
          user.achievements[achievementIndex].unlockedAt = new Date();
          user.achievementPoints += achievement.points;

          // Otorgar recompensa si existe
          if (achievement.reward.type === 'points') {
            user.referralPoints += achievement.reward.points;
          } else if (achievement.reward.rewardId) {
            // Agregar recompensa a ownedRewards si no la tiene
            const hasReward = user.ownedRewards.some(
              r => r.rewardId.toString() === achievement.reward.rewardId.toString()
            );
            if (!hasReward) {
              user.ownedRewards.push({
                rewardId: achievement.reward.rewardId,
                purchasedAt: new Date()
              });
            }
          }

          newAchievements.push(achievement);

          // Crear notificación
          await Notification.create({
            userId: user._id,
            type: 'achievement',
            message: `¡Has desbloqueado el logro "${achievement.name}"!`,
            metadata: {
              achievementId: achievement._id,
              achievementName: achievement.name,
              achievementIcon: achievement.icon,
              points: achievement.points
            }
          });

          console.log(`🏆 Usuario ${user.username} desbloqueó: ${achievement.name}`);
        }
      }
    }

    await user.save();

    return newAchievements;
  } catch (error) {
    console.error('Error al verificar logros:', error);
    return [];
  }
}

/**
 * Verifica logros especiales basados en condiciones específicas
 */
async function checkSpecialAchievement(userId, specialType, data = {}) {
  try {
    const user = await User.findById(userId).populate('achievements.achievementId');
    if (!user) return;

    let achievementName = null;

    switch (specialType) {
      case 'profile_completed':
        achievementName = 'Bienvenido a Azeroth';
        break;

      case 'early_bird':
        achievementName = 'Madrugador';
        break;

      case 'night_owl':
        achievementName = 'Noctámbulo';
        break;

      case 'streak':
        if (data.days >= 7) {
          achievementName = 'Racha de Fuego';
        }
        break;

      case 'veteran':
        const accountAge = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));
        if (accountAge >= 30) {
          achievementName = 'Veterano';
        }
        break;
    }

    if (!achievementName) return;

    const achievement = await Achievement.findOne({ name: achievementName, isActive: true });
    if (!achievement) return;

    // Verificar si ya tiene el logro
    const hasAchievement = user.achievements.some(
      a => a.achievementId._id.toString() === achievement._id.toString() && a.unlockedAt
    );

    if (hasAchievement) return;

    // Otorgar logro
    const achievementIndex = user.achievements.findIndex(
      a => a.achievementId._id.toString() === achievement._id.toString()
    );

    if (achievementIndex !== -1) {
      user.achievements[achievementIndex].unlockedAt = new Date();
      user.achievements[achievementIndex].progress = achievement.requirement.value;
    } else {
      user.achievements.push({
        achievementId: achievement._id,
        progress: achievement.requirement.value,
        unlockedAt: new Date()
      });
    }

    user.achievementPoints += achievement.points;

    // Otorgar recompensa
    if (achievement.reward.type === 'points') {
      user.referralPoints += achievement.reward.points;
    }

    await user.save();

    // Crear notificación
    await Notification.create({
      userId: user._id,
      type: 'achievement',
      message: `¡Has desbloqueado el logro secreto "${achievement.name}"!`,
      metadata: {
        achievementId: achievement._id,
        achievementName: achievement.name,
        achievementIcon: achievement.icon,
        points: achievement.points
      }
    });

    console.log(`🏆 Usuario ${user.username} desbloqueó logro especial: ${achievement.name}`);
    return achievement;
  } catch (error) {
    console.error('Error al verificar logro especial:', error);
    return null;
  }
}

module.exports = {
  checkAndGrantAchievements,
  checkSpecialAchievement
};
