const DailyMission = require('../models/DailyMission');
const UserMissionProgress = require('../models/UserMissionProgress');
const User = require('../models/User');
const Category = require('../models/Category');

// Plantillas de misiones
const MISSION_TEMPLATES = [
  {
    type: 'create_post',
    title: 'Comparte tu conocimiento',
    description: 'Crea {value} post(s) en cualquier categoría',
    icon: '📝',
    difficulty: 'easy',
    baseValue: 1,
    baseReward: 100
  },
  {
    type: 'create_reply',
    title: 'Participa en la comunidad',
    description: 'Responde {value} veces a otros posts',
    icon: '💬',
    difficulty: 'easy',
    baseValue: 3,
    baseReward: 75
  },
  {
    type: 'earn_xp',
    title: 'Gana experiencia',
    description: 'Obtén {value} puntos de XP',
    icon: '⭐',
    difficulty: 'medium',
    baseValue: 50,
    baseReward: 150
  },
  {
    type: 'daily_login',
    title: 'Visita diaria',
    description: 'Inicia sesión en el foro',
    icon: '🎯',
    difficulty: 'easy',
    baseValue: 1,
    baseReward: 50
  },
  {
    type: 'visit_category',
    title: 'Explora una categoría',
    description: 'Visita y lee posts en {categoryName}',
    icon: '🔍',
    difficulty: 'easy',
    baseValue: 1,
    baseReward: 80,
    requiresCategory: true
  }
];

// Generar misiones diarias
exports.generateDailyMissions = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Verificar si ya existen misiones para hoy
    const existingMissions = await DailyMission.find({ date: today });
    if (existingMissions.length > 0) {
      console.log('✅ Misiones diarias ya existen para hoy');
      return existingMissions;
    }
    
    // Seleccionar 3 misiones aleatorias
    const selectedTemplates = [];
    const availableTemplates = [...MISSION_TEMPLATES];
    
    for (let i = 0; i < 3 && availableTemplates.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * availableTemplates.length);
      selectedTemplates.push(availableTemplates.splice(randomIndex, 1)[0]);
    }
    
    // Crear misiones
    const missions = [];
    for (const template of selectedTemplates) {
      let categoryId = null;
      let description = template.description;
      
      // Si requiere categoría, seleccionar una aleatoria
      if (template.requiresCategory) {
        const categories = await Category.find({ isActive: true });
        if (categories.length > 0) {
          const randomCategory = categories[Math.floor(Math.random() * categories.length)];
          categoryId = randomCategory._id;
          description = description.replace('{categoryName}', randomCategory.name);
        }
      }
      
      description = description.replace('{value}', template.baseValue);
      
      const mission = new DailyMission({
        type: template.type,
        title: template.title,
        description,
        icon: template.icon,
        requirement: {
          value: template.baseValue,
          categoryId
        },
        reward: {
          points: template.baseReward,
          xp: Math.floor(template.baseReward / 2)
        },
        difficulty: template.difficulty,
        date: today,
        expiresAt: tomorrow
      });
      
      await mission.save();
      missions.push(mission);
    }
    
    console.log(`✅ ${missions.length} misiones diarias generadas para ${today.toDateString()}`);
    return missions;
  } catch (err) {
    console.error('Error generando misiones diarias:', err);
    throw err;
  }
};

// Obtener misiones del día
exports.getTodayMissions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Obtener misiones del día
    let missions = await DailyMission.find({ date: today }).populate('requirement.categoryId');
    
    // Si no hay misiones, generarlas
    if (missions.length === 0) {
      missions = await exports.generateDailyMissions();
    }
    
    // Obtener progreso del usuario
    const userProgress = await UserMissionProgress.find({
      userId,
      date: today
    });
    
    // Combinar misiones con progreso
    const missionsWithProgress = missions.map(mission => {
      const progress = userProgress.find(p => p.missionId.toString() === mission._id.toString());
      return {
        ...mission.toObject(),
        progress: progress ? progress.progress : 0,
        completed: progress ? progress.completed : false,
        claimed: progress ? progress.claimed : false
      };
    });
    
    // Obtener racha del usuario
    const user = await User.findById(userId);
    const streak = user.dailyStreak || { current: 0, longest: 0 };
    
    res.json({
      missions: missionsWithProgress,
      streak,
      date: today
    });
  } catch (err) {
    console.error('Error al obtener misiones:', err);
    res.status(500).json({ message: 'Error al cargar misiones', error: err.message });
  }
};

// Actualizar progreso de misión
exports.updateMissionProgress = async (userId, missionType, value = 1, categoryId = null) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Buscar misiones del tipo correspondiente
    const query = { date: today, type: missionType };
    if (categoryId) {
      query['requirement.categoryId'] = categoryId;
    }
    
    const missions = await DailyMission.find(query);
    
    for (const mission of missions) {
      // Buscar o crear progreso
      let progress = await UserMissionProgress.findOne({
        userId,
        missionId: mission._id,
        date: today
      });
      
      if (!progress) {
        progress = new UserMissionProgress({
          userId,
          missionId: mission._id,
          progress: 0,
          date: today
        });
      }
      
      // Actualizar progreso
      if (!progress.completed) {
        progress.progress = Math.min(progress.progress + value, mission.requirement.value);
        
        // Verificar si se completó
        if (progress.progress >= mission.requirement.value) {
          progress.completed = true;
          progress.completedAt = new Date();
        }
        
        await progress.save();
      }
    }
  } catch (err) {
    console.error('Error actualizando progreso de misión:', err);
  }
};

// Reclamar recompensa de misión
exports.claimMissionReward = async (req, res) => {
  try {
    const { missionId } = req.params;
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Buscar progreso
    const progress = await UserMissionProgress.findOne({
      userId,
      missionId,
      date: today
    });
    
    if (!progress) {
      return res.status(404).json({ message: 'Progreso de misión no encontrado' });
    }
    
    if (!progress.completed) {
      return res.status(400).json({ message: 'Misión no completada' });
    }
    
    if (progress.claimed) {
      return res.status(400).json({ message: 'Recompensa ya reclamada' });
    }
    
    // Obtener misión
    const mission = await DailyMission.findById(missionId);
    if (!mission) {
      return res.status(404).json({ message: 'Misión no encontrada' });
    }
    
    // Obtener usuario
    const user = await User.findById(userId);
    
    // Calcular bono por racha
    const streakBonus = Math.floor(mission.reward.points * (user.dailyStreak.current * 0.1));
    const totalPoints = mission.reward.points + streakBonus;
    
    // Otorgar recompensas
    user.achievementPoints += totalPoints;
    user.xp += mission.reward.xp;
    await user.save();
    
    // Marcar como reclamada
    progress.claimed = true;
    progress.claimedAt = new Date();
    await progress.save();
    
    // Verificar si completó todas las misiones del día
    const allMissions = await DailyMission.find({ date: today });
    const allProgress = await UserMissionProgress.find({
      userId,
      date: today,
      claimed: true
    });
    
    let weeklyBonus = 0;
    if (allMissions.length === allProgress.length) {
      // Actualizar racha
      await exports.updateStreak(userId);
      
      // Verificar bono semanal (7 días consecutivos)
      const updatedUser = await User.findById(userId);
      if (updatedUser.dailyStreak.current % 7 === 0 && updatedUser.dailyStreak.current > 0) {
        weeklyBonus = 500;
        updatedUser.achievementPoints += weeklyBonus;
        await updatedUser.save();
      }
    }
    
    res.json({
      success: true,
      message: 'Recompensa reclamada',
      rewards: {
        points: mission.reward.points,
        streakBonus,
        weeklyBonus,
        totalPoints: totalPoints + weeklyBonus,
        xp: mission.reward.xp
      },
      newTotals: {
        achievementPoints: user.achievementPoints + weeklyBonus,
        xp: user.xp
      }
    });
  } catch (err) {
    console.error('Error reclamando recompensa:', err);
    res.status(500).json({ message: 'Error al reclamar recompensa', error: err.message });
  }
};

// Actualizar racha del usuario
exports.updateStreak = async (userId) => {
  try {
    const user = await User.findById(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastLogin = user.dailyStreak.lastLoginDate ? new Date(user.dailyStreak.lastLoginDate) : null;
    
    if (lastLogin) {
      lastLogin.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today - lastLogin) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Día consecutivo
        user.dailyStreak.current += 1;
        if (user.dailyStreak.current > user.dailyStreak.longest) {
          user.dailyStreak.longest = user.dailyStreak.current;
        }
      } else if (daysDiff > 1) {
        // Se rompió la racha
        user.dailyStreak.current = 1;
      }
      // Si daysDiff === 0, ya inició sesión hoy
    } else {
      // Primera vez
      user.dailyStreak.current = 1;
      user.dailyStreak.longest = 1;
    }
    
    user.dailyStreak.lastLoginDate = today;
    await user.save();
    
    return user.dailyStreak;
  } catch (err) {
    console.error('Error actualizando racha:', err);
    throw err;
  }
};

// Obtener estadísticas de misiones
exports.getMissionStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Total de misiones completadas
    const totalCompleted = await UserMissionProgress.countDocuments({
      userId,
      completed: true
    });
    
    // Misiones completadas este mes
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthCompleted = await UserMissionProgress.countDocuments({
      userId,
      completed: true,
      completedAt: { $gte: startOfMonth }
    });
    
    // Racha del usuario
    const user = await User.findById(userId);
    const streak = user.dailyStreak || { current: 0, longest: 0 };
    
    res.json({
      totalCompleted,
      monthCompleted,
      streak
    });
  } catch (err) {
    console.error('Error obteniendo estadísticas:', err);
    res.status(500).json({ message: 'Error al cargar estadísticas', error: err.message });
  }
};
