const User = require('../models/User');
const Achievement = require('../models/Achievement');
const RewardItem = require('../models/RewardItem');

/**
 * Obtener todos los logros disponibles
 */
exports.getAllAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.find({ isActive: true })
      .populate('reward.rewardId')
      .sort({ rarity: 1, points: 1 });
    
    res.json(achievements);
  } catch (err) {
    console.error('Error getting achievements:', err);
    res.status(500).json({ message: 'Error al obtener logros', error: err.message });
  }
};

/**
 * Obtener logros por categoría
 */
exports.getAchievementsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    const achievements = await Achievement.find({ 
      category, 
      isActive: true 
    })
      .populate('reward.rewardId')
      .sort({ points: 1 });
    
    res.json(achievements);
  } catch (err) {
    console.error('Error getting achievements by category:', err);
    res.status(500).json({ message: 'Error al obtener logros', error: err.message });
  }
};

/**
 * Obtener logros del usuario actual
 */
exports.getMyAchievements = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId)
      .populate({
        path: 'achievements.achievementId',
        populate: { path: 'reward.rewardId' }
      });
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json({
      achievements: user.achievements,
      achievementPoints: user.achievementPoints
    });
  } catch (err) {
    console.error('Error getting user achievements:', err);
    res.status(500).json({ message: 'Error al obtener logros del usuario', error: err.message });
  }
};

/**
 * Verificar un logro específico
 */
exports.checkAchievement = async (req, res) => {
  try {
    const { achievementId } = req.params;
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const achievement = await Achievement.findById(achievementId);
    if (!achievement) {
      return res.status(404).json({ message: 'Logro no encontrado' });
    }
    
    // Verificar si ya tiene el logro
    const hasAchievement = user.achievements.some(
      a => a.achievementId.toString() === achievementId
    );
    
    if (hasAchievement) {
      return res.json({ 
        message: 'Ya tienes este logro',
        unlocked: true 
      });
    }
    
    // Verificar si cumple los requisitos
    const meetsRequirement = checkRequirement(user, achievement);
    
    if (meetsRequirement) {
      // Desbloquear logro
      user.achievements.push({
        achievementId: achievement._id,
        unlockedAt: new Date(),
        progress: 100
      });
      
      user.achievementPoints += achievement.points;
      
      // Otorgar recompensa si existe
      if (achievement.reward && achievement.reward.rewardId) {
        const alreadyOwned = user.ownedRewards.some(
          r => r.rewardId.toString() === achievement.reward.rewardId.toString()
        );
        
        if (!alreadyOwned) {
          user.ownedRewards.push({
            rewardId: achievement.reward.rewardId,
            purchasedAt: new Date()
          });
        }
      }
      
      // Otorgar puntos de referido adicionales
      if (achievement.reward && achievement.reward.points) {
        user.referralPoints += achievement.reward.points;
      }
      
      await user.save();
      
      // Emitir notificación de logro desbloqueado
      if (req.io) {
        req.io.to(userId).emit('achievementUnlocked', {
          achievement: {
            _id: achievement._id,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            rarity: achievement.rarity,
            points: achievement.points
          },
          reward: achievement.reward
        });
      }
      
      return res.json({
        message: '¡Logro desbloqueado!',
        unlocked: true,
        achievement,
        reward: achievement.reward
      });
    }
    
    // Calcular progreso
    const progress = calculateProgress(user, achievement);
    
    res.json({
      message: 'Aún no cumples los requisitos',
      unlocked: false,
      progress
    });
  } catch (err) {
    console.error('Error checking achievement:', err);
    res.status(500).json({ message: 'Error al verificar logro', error: err.message });
  }
};

/**
 * Verificar todos los logros del usuario
 */
exports.checkAllAchievements = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const achievements = await Achievement.find({ isActive: true });
    const unlockedAchievements = [];
    
    for (const achievement of achievements) {
      // Verificar si ya tiene el logro
      const hasAchievement = user.achievements.some(
        a => a.achievementId.toString() === achievement._id.toString()
      );
      
      if (hasAchievement) continue;
      
      // Verificar si cumple los requisitos
      const meetsRequirement = checkRequirement(user, achievement);
      
      if (meetsRequirement) {
        // Desbloquear logro
        user.achievements.push({
          achievementId: achievement._id,
          unlockedAt: new Date(),
          progress: 100
        });
        
        user.achievementPoints += achievement.points;
        
        // Otorgar recompensa si existe
        if (achievement.reward && achievement.reward.rewardId) {
          const alreadyOwned = user.ownedRewards.some(
            r => r.rewardId.toString() === achievement.reward.rewardId.toString()
          );
          
          if (!alreadyOwned) {
            user.ownedRewards.push({
              rewardId: achievement.reward.rewardId,
              purchasedAt: new Date()
            });
          }
        }
        
        // Otorgar puntos de referido adicionales
        if (achievement.reward && achievement.reward.points) {
          user.referralPoints += achievement.reward.points;
        }
        
        unlockedAchievements.push(achievement);
      }
    }
    
    if (unlockedAchievements.length > 0) {
      await user.save();
    }
    
    res.json({
      message: `${unlockedAchievements.length} logros desbloqueados`,
      unlockedCount: unlockedAchievements.length,
      achievements: unlockedAchievements
    });
  } catch (err) {
    console.error('Error checking all achievements:', err);
    res.status(500).json({ message: 'Error al verificar logros', error: err.message });
  }
};

/**
 * Crear un nuevo logro (Admin)
 */
exports.createAchievement = async (req, res) => {
  try {
    const achievementData = req.body;
    
    const achievement = new Achievement(achievementData);
    await achievement.save();
    
    res.status(201).json({
      message: 'Logro creado exitosamente',
      achievement
    });
  } catch (err) {
    console.error('Error creating achievement:', err);
    res.status(500).json({ message: 'Error al crear logro', error: err.message });
  }
};

/**
 * Actualizar un logro (Admin)
 */
exports.updateAchievement = async (req, res) => {
  try {
    const { achievementId } = req.params;
    const updateData = req.body;
    
    const achievement = await Achievement.findByIdAndUpdate(
      achievementId,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!achievement) {
      return res.status(404).json({ message: 'Logro no encontrado' });
    }
    
    res.json({
      message: 'Logro actualizado exitosamente',
      achievement
    });
  } catch (err) {
    console.error('Error updating achievement:', err);
    res.status(500).json({ message: 'Error al actualizar logro', error: err.message });
  }
};

/**
 * Eliminar un logro (Admin)
 */
exports.deleteAchievement = async (req, res) => {
  try {
    const { achievementId } = req.params;
    
    const achievement = await Achievement.findByIdAndUpdate(
      achievementId,
      { isActive: false },
      { new: true }
    );
    
    if (!achievement) {
      return res.status(404).json({ message: 'Logro no encontrado' });
    }
    
    res.json({
      message: 'Logro desactivado exitosamente',
      achievement
    });
  } catch (err) {
    console.error('Error deleting achievement:', err);
    res.status(500).json({ message: 'Error al eliminar logro', error: err.message });
  }
};

/**
 * Función auxiliar: Verificar si cumple requisitos
 */
function checkRequirement(user, achievement) {
  const { type, value } = achievement.requirement;
  
  switch (type) {
    case 'xp':
      return user.xp >= value;
    case 'posts':
      return user.postCount >= value;
    case 'replies':
      return user.replyCount >= value;
    case 'likes':
      // Necesitaríamos un campo likesReceived en User
      return false;
    case 'referrals':
      return user.totalReferrals >= value;
    case 'special':
      // Lógica especial personalizada
      return false;
    default:
      return false;
  }
}

/**
 * Función auxiliar: Calcular progreso
 */
function calculateProgress(user, achievement) {
  const { type, value } = achievement.requirement;
  let current = 0;
  
  switch (type) {
    case 'xp':
      current = user.xp;
      break;
    case 'posts':
      current = user.postCount;
      break;
    case 'replies':
      current = user.replyCount;
      break;
    case 'referrals':
      current = user.totalReferrals;
      break;
    default:
      current = 0;
  }
  
  return Math.min(100, Math.round((current / value) * 100));
}
