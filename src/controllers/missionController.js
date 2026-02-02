const DailyMission = require('../models/DailyMission');
const UserMissionProgress = require('../models/UserMissionProgress');
const User = require('../models/User');
const Category = require('../models/Category');

// Plantillas de misiones mejoradas
const MISSION_TEMPLATES = [
  {
    type: 'create_post',
    title: 'Comparte tu conocimiento',
    description: 'Crea {value} post(s) en cualquier categoría',
    icon: '📝',
    difficulty: 'easy',
    baseValue: 1,
    baseReward: 100,
    maxWeeklyOccurrences: 2 // Máximo 2 veces por semana
  },
  {
    type: 'create_reply',
    title: 'Participa en la comunidad',
    description: 'Responde {value} veces a otros posts',
    icon: '💬',
    difficulty: 'easy',
    baseValue: 3,
    baseReward: 75,
    maxWeeklyOccurrences: 3 // Máximo 3 veces por semana
  },
  {
    type: 'earn_xp',
    title: 'Gana experiencia',
    description: 'Obtén {value} puntos de XP',
    icon: '⭐',
    difficulty: 'medium',
    baseValue: 50,
    baseReward: 150,
    maxWeeklyOccurrences: 2 // Máximo 2 veces por semana
  },
  {
    type: 'daily_login',
    title: 'Visita diaria',
    description: 'Inicia sesión en el foro',
    icon: '🎯',
    difficulty: 'easy',
    baseValue: 1,
    baseReward: 50,
    maxWeeklyOccurrences: 7 // Máximo 1 vez por día, 7 por semana
  },
  {
    type: 'visit_category',
    title: 'Explora una categoría',
    description: 'Visita y lee posts en {categoryName}',
    icon: '🔍',
    difficulty: 'easy',
    baseValue: 1,
    baseReward: 80,
    requiresCategory: true,
    maxWeeklyOccurrences: 3 // Máximo 3 veces por semana
  }
];

// Utilidades para manejo de fechas y semanas
const DateUtils = {
  // Obtener inicio del día (00:00:00)
  getStartOfDay: (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // Obtener fin del día (23:59:59)
  getEndOfDay: (date = new Date()) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  // Obtener inicio de la semana (lunes 00:00:00)
  getStartOfWeek: (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para que lunes sea 0
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // Obtener fin de la semana (domingo 23:59:59)
  getEndOfWeek: (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Ajustar para que domingo sea 7
    d.setDate(diff);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  // Verificar si una fecha está en la semana actual
  isCurrentWeek: (date) => {
    const now = new Date();
    const startOfWeek = DateUtils.getStartOfWeek(now);
    const endOfWeek = DateUtils.getEndOfWeek(now);
    const checkDate = new Date(date);
    return checkDate >= startOfWeek && checkDate <= endOfWeek;
  },

  // Obtener número de semana del año
  getWeekNumber: (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
};

// Sistema de logging mejorado
const Logger = {
  mission: (action, data) => {
    console.log(`🎯 [MISIÓN] ${action}:`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  },

  progress: (action, data) => {
    console.log(`📊 [PROGRESO] ${action}:`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  },

  error: (action, error, data) => {
    console.error(`❌ [ERROR] ${action}:`, {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      ...data
    });
  },

  warning: (action, data) => {
    console.warn(`⚠️ [ADVERTENCIA] ${action}:`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  }
};

// Validador de misiones
const MissionValidator = {
  // Verificar si una misión puede aparecer esta semana
  canAppearThisWeek: async (missionType, userId) => {
    try {
      const startOfWeek = DateUtils.getStartOfWeek();
      const endOfWeek = DateUtils.getEndOfWeek();
      
      const template = MISSION_TEMPLATES.find(t => t.type === missionType);
      if (!template || !template.maxWeeklyOccurrences) {
        return true; // Sin restricción semanal
      }

      // Contar misiones de este tipo en la semana actual
      const weeklyMissions = await DailyMission.find({
        type: missionType,
        date: { $gte: startOfWeek, $lte: endOfWeek }
      });

      Logger.mission('VERIFICACIÓN SEMANAL', {
        missionType,
        weeklyCount: weeklyMissions.length,
        maxAllowed: template.maxWeeklyOccurrences,
        canAppear: weeklyMissions.length < template.maxWeeklyOccurrences
      });

      return weeklyMissions.length < template.maxWeeklyOccurrences;
    } catch (error) {
      Logger.error('VERIFICACIÓN SEMANAL', error, { missionType, userId });
      return true; // Permitir en caso de error
    }
  },

  // Validar integridad del progreso
  validateProgressIntegrity: async (userId, missionId, expectedProgress) => {
    try {
      const today = DateUtils.getStartOfDay();
      const progress = await UserMissionProgress.findOne({
        userId,
        missionId,
        date: today
      });

      if (!progress) {
        Logger.warning('PROGRESO NO ENCONTRADO', { userId, missionId, expectedProgress });
        return { valid: false, reason: 'PROGRESO_NO_ENCONTRADO' };
      }

      // Verificar que el progreso sea consistente
      const isConsistent = progress.progress === expectedProgress;
      
      if (!isConsistent) {
        Logger.warning('PROGRESO INCONSISTENTE', {
          userId,
          missionId,
          stored: progress.progress,
          expected: expectedProgress,
          completed: progress.completed
        });
      }

      return { 
        valid: isConsistent, 
        progress,
        reason: isConsistent ? 'OK' : 'PROGRESO_INCONSISTENTE'
      };
    } catch (error) {
      Logger.error('VALIDACIÓN INTEGRIDAD', error, { userId, missionId, expectedProgress });
      return { valid: false, reason: 'ERROR_VALIDACIÓN' };
    }
  }
};

// Generar misiones diarias con prevención de duplicados
exports.generateDailyMissions = async () => {
  try {
    const today = DateUtils.getStartOfDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    Logger.mission('INICIO GENERACIÓN', { date: today.toISOString() });
    
    // Verificar si ya existen misiones para hoy
    const existingMissions = await DailyMission.find({ date: today });
    if (existingMissions.length > 0) {
      Logger.mission('MISIONES YA EXISTEN', { count: existingMissions.length });
      return existingMissions;
    }
    
    // Seleccionar misiones aleatorias sin duplicados semanales
    const selectedTemplates = [];
    const availableTemplates = [...MISSION_TEMPLATES];
    
    for (let i = 0; i < 3 && availableTemplates.length > 0; i++) {
      let attempts = 0;
      let selectedTemplate = null;
      
      // Intentar encontrar una misión que no exceda el límite semanal
      while (attempts < availableTemplates.length && !selectedTemplate) {
        const randomIndex = Math.floor(Math.random() * availableTemplates.length);
        const template = availableTemplates[randomIndex];
        
        const canAppear = await MissionValidator.canAppearThisWeek(template.type);
        
        if (canAppear) {
          selectedTemplate = template;
          availableTemplates.splice(randomIndex, 1);
          Logger.mission('PLANTILLA SELECCIONADA', {
            type: template.type,
            title: template.title,
            attempts: attempts + 1
          });
        } else {
          attempts++;
          Logger.warning('PLANTILLA RECHAZADA', {
            type: template.type,
            reason: 'LÍMITE SEMANAL EXCEDIDO'
          });
        }
      }
      
      if (selectedTemplate) {
        selectedTemplates.push(selectedTemplate);
      }
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
          Logger.mission('CATEGORÍA ASIGNADA', {
            missionType: template.type,
            categoryId: categoryId.toString(),
            categoryName: randomCategory.name
          });
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
        expiresAt: tomorrow,
        weekNumber: DateUtils.getWeekNumber(today)
      });
      
      await mission.save();
      missions.push(mission);
      
      Logger.mission('MISIÓN CREADA', {
        missionId: mission._id.toString(),
        type: mission.type,
        title: mission.title,
        requirement: mission.requirement,
        reward: mission.reward
      });
    }
    
    Logger.mission('GENERACIÓN COMPLETADA', {
      totalMissions: missions.length,
      date: today.toISOString(),
      missions: missions.map(m => ({
        id: m._id.toString(),
        type: m.type,
        title: m.title
      }))
    });
    
    return missions;
  } catch (err) {
    Logger.error('GENERACIÓN MISIONES', err);
    throw err;
  }
};

// Obtener misiones del día con validación completa
exports.getTodayMissions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = DateUtils.getStartOfDay();
    
    Logger.progress('INICIO OBTENCIÓN', { userId, date: today.toISOString() });
    
    // Obtener misiones del día
    let missions = await DailyMission.find({ date: today }).populate('requirement.categoryId');
    
    // Si no hay misiones, generarlas
    if (missions.length === 0) {
      Logger.mission('GENERANDO MISIONES AUTOMÁTICAS', { userId });
      missions = await exports.generateDailyMissions();
    }
    
    // Obtener progreso del usuario
    const userProgress = await UserMissionProgress.find({
      userId,
      date: today
    });
    
    // Validar integridad del progreso
    const validatedProgress = [];
    for (const progress of userProgress) {
      const mission = missions.find(m => m._id.toString() === progress.missionId.toString());
      if (mission) {
        const validation = await MissionValidator.validateProgressIntegrity(
          userId, 
          progress.missionId, 
          progress.progress
        );
        
        if (!validation.valid) {
          Logger.warning('CORRIGIENDO PROGRESO', {
            missionId: progress.missionId.toString(),
            reason: validation.reason,
            oldProgress: progress.progress
          });
          
          // Corregir progreso si es necesario
          if (validation.reason === 'PROGRESO_INCONSISTENTE' && validation.progress) {
            await validation.progress.save();
          }
        }
        
        validatedProgress.push(validation.progress || progress);
      }
    }
    
    // Combinar misiones con progreso validado
    const missionsWithProgress = missions.map(mission => {
      const progress = validatedProgress.find(p => p.missionId.toString() === mission._id.toString());
      return {
        ...mission.toObject(),
        progress: progress ? progress.progress : 0,
        completed: progress ? progress.completed : false,
        claimed: progress ? progress.claimed : false,
        validated: !!progress
      };
    });
    
    // Obtener racha del usuario
    const user = await User.findById(userId);
    const streak = user.dailyStreak || { current: 0, longest: 0 };
    
    Logger.progress('OBTENCIÓN COMPLETADA', {
      userId,
      missionsCount: missionsWithProgress.length,
      completedCount: missionsWithProgress.filter(m => m.completed).length,
      streak: streak.current
    });
    
    res.json({
      missions: missionsWithProgress,
      streak,
      date: today,
      weekNumber: DateUtils.getWeekNumber(today)
    });
  } catch (err) {
    Logger.error('OBTENCIÓN MISIONES', err, { userId: req.user.userId });
    res.status(500).json({ message: 'Error al cargar misiones', error: err.message });
  }
};

// Actualizar progreso de misión con manejo robusto de errores
exports.updateMissionProgress = async (userId, missionType, value = 1, categoryId = null) => {
  try {
    const today = DateUtils.getStartOfDay();
    
    Logger.progress('INICIO ACTUALIZACIÓN', {
      userId,
      missionType,
      value,
      categoryId,
      date: today.toISOString()
    });
    
    // Buscar misiones del tipo correspondiente
    const query = { date: today, type: missionType };
    if (categoryId) {
      query['requirement.categoryId'] = categoryId;
    }
    
    const missions = await DailyMission.find(query);
    
    if (missions.length === 0) {
      Logger.warning('SIN MISIONES DEL TIPO', {
        userId,
        missionType,
        categoryId,
        date: today.toISOString()
      });
      
      // Listar todas las misiones de hoy para debug
      const allMissions = await DailyMission.find({ date: today });
      Logger.mission('MISIONES DEL DÍA', {
        date: today.toISOString(),
        total: allMissions.length,
        types: allMissions.map(m => ({ type: m.type, title: m.title }))
      });
      
      return; // Salir silenciosamente si no hay misiones de este tipo
    }
    
    let updatedMissions = 0;
    
    for (const mission of missions) {
      try {
        // Buscar o crear progreso con manejo de duplicados
        let progress = await UserMissionProgress.findOne({
          userId,
          missionId: mission._id,
          date: today
        });
        
        if (!progress) {
          Logger.progress('CREANDO PROGRESO', {
            userId,
            missionId: mission._id.toString(),
            missionTitle: mission.title
          });
          
          progress = new UserMissionProgress({
            userId,
            missionId: mission._id,
            progress: 0,
            date: today
          });
        }
        
        // Actualizar progreso solo si no está completado
        if (!progress.completed) {
          const oldProgress = progress.progress;
          const newProgress = Math.min(oldProgress + value, mission.requirement.value);
          
          // Solo actualizar si hay cambio real
          if (newProgress !== oldProgress) {
            progress.progress = newProgress;
            
            Logger.progress('PROGRESO ACTUALIZADO', {
              userId,
              missionId: mission._id.toString(),
              missionTitle: mission.title,
              oldProgress,
              newProgress,
              required: mission.requirement.value
            });
            
            // Verificar si se completó
            if (newProgress >= mission.requirement.value) {
              Logger.progress('MISIÓN COMPLETADA', {
                userId,
                missionId: mission._id.toString(),
                missionTitle: mission.title,
                progress: newProgress,
                required: mission.requirement.value
              });
              
              progress.completed = true;
              progress.completedAt = new Date();
              
              // Crear notificación de misión completada
              try {
                const Notification = require('../models/Notification');
                await Notification.create({
                  user: userId,
                  type: 'mission_completed',
                  message: `¡Misión completada! "${mission.title}" - Reclama tu recompensa de ${mission.reward.points} puntos`,
                  link: '/daily-missions',
                  read: false
                });
                
                Logger.progress('NOTIFICACIÓN CREADA', {
                  userId,
                  missionId: mission._id.toString(),
                  missionTitle: mission.title
                });
              } catch (notificationError) {
                Logger.error('CREACIÓN NOTIFICACIÓN', notificationError, {
                  userId,
                  missionId: mission._id.toString()
                });
              }
            }
            
            // Guardar el progreso con reintentos en caso de error
            try {
              await progress.save();
              updatedMissions++;
            } catch (saveError) {
              Logger.error('ERROR GUARDANDO PROGRESO', saveError, {
                userId,
                missionId: mission._id.toString(),
                missionTitle: mission.title,
                progress: newProgress
              });
              // Reintentar una vez más
              try {
                await progress.save();
                updatedMissions++;
              } catch (retryError) {
                Logger.error('ERROR GUARDANDO PROGRESO (REINTENTO)', retryError, {
                  userId,
                  missionId: mission._id.toString()
                });
              }
            }
          } else {
            Logger.progress('PROGRESO SIN CAMBIOS', {
              userId,
              missionId: mission._id.toString(),
              missionTitle: mission.title,
              progress: oldProgress
            });
          }
        } else {
          Logger.progress('MISIÓN YA COMPLETADA', {
            userId,
            missionId: mission._id.toString(),
            missionTitle: mission.title,
            progress: progress.progress,
            claimed: progress.claimed
          });
        }
      } catch (missionError) {
        Logger.error('PROCESO MISIÓN INDIVIDUAL', missionError, {
          userId,
          missionId: mission._id.toString(),
          missionTitle: mission.title
        });
        // Continuar con las demás misiones
        continue;
      }
    }
    
    Logger.progress('ACTUALIZACIÓN COMPLETADA', {
      userId,
      missionType,
      value,
      updatedMissions,
      totalMissions: missions.length
    });
    
  } catch (err) {
    Logger.error('ACTUALIZACIÓN PROGRESO', err, {
      userId,
      missionType,
      value,
      categoryId
    });
    // No lanzar error para no interrumpir el flujo principal
  }
};

// Reclamar recompensa de misión con validación mejorada
exports.claimMissionReward = async (req, res) => {
  try {
    const { missionId } = req.params;
    const userId = req.user.userId;
    const today = DateUtils.getStartOfDay();
    
    Logger.progress('INICIO RECLAMO', {
      userId,
      missionId,
      date: today.toISOString()
    });
    
    // Buscar progreso
    const progress = await UserMissionProgress.findOne({
      userId,
      missionId,
      date: today
    });
    
    if (!progress) {
      Logger.warning('PROGRESO NO ENCONTRADO', { userId, missionId });
      return res.status(404).json({ message: 'Progreso de misión no encontrado' });
    }
    
    if (!progress.completed) {
      Logger.warning('MISIÓN NO COMPLETADA', {
        userId,
        missionId,
        progress: progress.progress,
        completed: progress.completed
      });
      return res.status(400).json({ message: 'Misión no completada' });
    }
    
    if (progress.claimed) {
      Logger.warning('RECOMPENSA YA RECLAMADA', {
        userId,
        missionId,
        claimedAt: progress.claimedAt
      });
      return res.status(400).json({ message: 'Recompensa ya reclamada' });
    }
    
    // Obtener misión
    const mission = await DailyMission.findById(missionId);
    if (!mission) {
      Logger.warning('MISIÓN NO ENCONTRADA', { userId, missionId });
      return res.status(404).json({ message: 'Misión no encontrada' });
    }
    
    // Validar integridad del progreso
    const validation = await MissionValidator.validateProgressIntegrity(
      userId, 
      missionId, 
      progress.progress
    );
    
    if (!validation.valid) {
      Logger.error('PROGRESO INVÁLIDO', new Error('Progreso inválido'), {
        userId,
        missionId,
        reason: validation.reason
      });
      return res.status(400).json({ 
        message: 'Error de validación en el progreso',
        reason: validation.reason 
      });
    }
    
    // Obtener usuario
    const user = await User.findById(userId);
    
    // Calcular bono por racha
    const streakBonus = Math.floor(mission.reward.points * (user.dailyStreak.current * 0.1));
    const totalPoints = mission.reward.points + streakBonus;
    
    // Otorgar recompensas con validación
    const oldPoints = user.achievementPoints || 0;
    const oldXp = user.xp || 0;
    
    user.achievementPoints = oldPoints + totalPoints;
    user.xp = oldXp + mission.reward.xp;
    await user.save();
    
    // Marcar como reclamada
    progress.claimed = true;
    progress.claimedAt = new Date();
    await progress.save();
    
    Logger.progress('RECOMPENSA RECLAMADA', {
      userId,
      missionId,
      missionTitle: mission.title,
      points: mission.reward.points,
      streakBonus,
      totalPoints,
      xp: mission.reward.xp,
      oldPoints,
      newPoints: user.achievementPoints,
      oldXp,
      newXp: user.xp
    });
    
    // Verificar si completó todas las misiones del día
    const allMissions = await DailyMission.find({ date: today });
    const allProgress = await UserMissionProgress.find({
      userId,
      date: today,
      claimed: true
    });
    
    let weeklyBonus = 0;
    if (allMissions.length === allProgress.length) {
      Logger.progress('TODAS LAS MISIONES COMPLETADAS', {
        userId,
        totalMissions: allMissions.length,
        claimedMissions: allProgress.length
      });
      
      // Actualizar racha
      await exports.updateStreak(userId);
      
      // Verificar bono semanal (7 días consecutivos)
      const updatedUser = await User.findById(userId);
      if (updatedUser.dailyStreak.current % 7 === 0 && updatedUser.dailyStreak.current > 0) {
        weeklyBonus = 500;
        updatedUser.achievementPoints += weeklyBonus;
        await updatedUser.save();
        
        Logger.progress('BONO SEMANAL OTORGADO', {
          userId,
          streak: updatedUser.dailyStreak.current,
          weeklyBonus
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Recompensa reclamada exitosamente',
      rewards: {
        points: mission.reward.points,
        streakBonus,
        weeklyBonus,
        totalPoints: totalPoints + weeklyBonus,
        xp: mission.reward.xp
      },
      newTotals: {
        achievementPoints: user.achievementPoints,
        xp: user.xp
      }
    });
  } catch (err) {
    Logger.error('RECLAMO RECOMPENSA', err, {
      userId: req.user.userId,
      missionId: req.params.missionId
    });
    res.status(500).json({ message: 'Error al reclamar recompensa', error: err.message });
  }
};

// Actualizar racha del usuario con manejo mejorado de fechas
exports.updateStreak = async (userId) => {
  try {
    const user = await User.findById(userId);
    const today = DateUtils.getStartOfDay();
    
    Logger.progress('INICIO ACTUALIZACIÓN RACHA', {
      userId,
      today: today.toISOString(),
      currentStreak: user.dailyStreak?.current || 0
    });
    
    const lastLogin = user.dailyStreak?.lastLoginDate ? new Date(user.dailyStreak.lastLoginDate) : null;
    
    if (lastLogin) {
      const lastLoginDay = DateUtils.getStartOfDay(lastLogin);
      const daysDiff = Math.floor((today - lastLoginDay) / (1000 * 60 * 60 * 24));
      
      Logger.progress('CÁLCULO DIFERENCIA DÍAS', {
        userId,
        today: today.toISOString(),
        lastLogin: lastLoginDay.toISOString(),
        daysDiff
      });
      
      if (daysDiff === 1) {
        // Día consecutivo
        user.dailyStreak.current += 1;
        if (user.dailyStreak.current > user.dailyStreak.longest) {
          user.dailyStreak.longest = user.dailyStreak.current;
        }
        
        Logger.progress('RACHA AUMENTADA', {
          userId,
          newStreak: user.dailyStreak.current,
          longest: user.dailyStreak.longest
        });
      } else if (daysDiff > 1) {
        // Se rompió la racha
        const oldStreak = user.dailyStreak.current;
        user.dailyStreak.current = 1;
        
        Logger.progress('RACHA REINICIADA', {
          userId,
          oldStreak,
          newStreak: 1,
          daysDiff
        });
      }
      // Si daysDiff === 0, ya inició sesión hoy
    } else {
      // Primera vez
      user.dailyStreak.current = 1;
      user.dailyStreak.longest = 1;
      
      Logger.progress('PRIMERA RACHA', { userId });
    }
    
    user.dailyStreak.lastLoginDate = today;
    await user.save();
    
    Logger.progress('RACHA ACTUALIZADA', {
      userId,
      finalStreak: user.dailyStreak.current,
      longest: user.dailyStreak.longest,
      lastLogin: user.dailyStreak.lastLoginDate
    });
    
    return user.dailyStreak;
  } catch (err) {
    Logger.error('ACTUALIZACIÓN RACHA', err, { userId });
    throw err;
  }
};

// Endpoint para forzar actualización de progreso de login
exports.forceLoginProgress = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    Logger.progress('FORZANDO LOGIN', { userId });
    
    // Forzar actualización de misión de login
    await exports.updateMissionProgress(userId, 'daily_login', 1);
    
    // Actualizar racha
    await exports.updateStreak(userId);
    
    res.json({
      success: true,
      message: 'Progreso de login forzado exitosamente',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    Logger.error('FORZAR LOGIN', err, { userId: req.user.userId });
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

// Endpoint de depuración para obtener estado completo
exports.getDebugInfo = async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = DateUtils.getStartOfDay();
    const startOfWeek = DateUtils.getStartOfWeek();
    const endOfWeek = DateUtils.getEndOfWeek();
    
    // Obtener toda la información relevante
    const [
      todayMissions,
      weekMissions,
      userProgress,
      user
    ] = await Promise.all([
      DailyMission.find({ date: today }),
      DailyMission.find({ date: { $gte: startOfWeek, $lte: endOfWeek } }),
      UserMissionProgress.find({ userId, date: today }),
      User.findById(userId)
    ]);
    
    const debugInfo = {
      user: {
        id: userId,
        streak: user.dailyStreak,
        achievementPoints: user.achievementPoints,
        xp: user.xp
      },
      dates: {
        today: today.toISOString(),
        startOfWeek: startOfWeek.toISOString(),
        endOfWeek: endOfWeek.toISOString(),
        weekNumber: DateUtils.getWeekNumber(today)
      },
      todayMissions: todayMissions.map(m => ({
        id: m._id.toString(),
        type: m.type,
        title: m.title,
        requirement: m.requirement,
        reward: m.reward
      })),
      weekMissions: weekMissions.map(m => ({
        id: m._id.toString(),
        type: m.type,
        title: m.title,
        date: m.date.toISOString()
      })),
      userProgress: userProgress.map(p => ({
        missionId: p.missionId.toString(),
        progress: p.progress,
        completed: p.completed,
        claimed: p.claimed,
        completedAt: p.completedAt,
        claimedAt: p.claimedAt
      }))
    };
    
    Logger.progress('DEBUG INFO OBTENIDA', { userId });
    
    res.json({
      success: true,
      debug: debugInfo
    });
  } catch (err) {
    Logger.error('DEBUG INFO', err, { userId: req.user.userId });
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo información de depuración',
      error: err.message 
    });
  }
};

// Validar y reclamar todas las recompensas disponibles
exports.validateAndClaimAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = DateUtils.getStartOfDay();
    
    Logger.progress('INICIO VALIDACIÓN Y RECLAMO MASIVO', {
      userId,
      date: today.toISOString()
    });
    
    // Obtener todas las misiones del día
    const missions = await DailyMission.find({ date: today });
    
    if (missions.length === 0) {
      Logger.warning('SIN MISIONES PARA VALIDAR', { userId });
      return res.json({
        success: false,
        message: 'No hay misiones disponibles hoy',
        claimedCount: 0,
        totalPoints: 0,
        totalXp: 0
      });
    }
    
    // Obtener progreso del usuario
    const userProgress = await UserMissionProgress.find({
      userId,
      date: today
    });
    
    let claimedCount = 0;
    let totalPoints = 0;
    let totalXp = 0;
    let weeklyBonus = 0;
    
    // Obtener usuario para actualizar puntos
    const user = await User.findById(userId);
    
    // Procesar cada misión completada
    for (const mission of missions) {
      try {
        const progress = userProgress.find(p => p.missionId.toString() === mission._id.toString());
        
        if (!progress) {
          Logger.progress('PROGRESO NO ENCONTRADO', {
            userId,
            missionId: mission._id.toString(),
            missionTitle: mission.title
          });
          continue;
        }
        
        // Si está completada pero no reclamada, reclamarla
        if (progress.completed && !progress.claimed) {
          Logger.progress('RECLAMANDO AUTOMÁTICAMENTE', {
            userId,
            missionId: mission._id.toString(),
            missionTitle: mission.title
          });
          
          // Calcular bono por racha
          const streakBonus = Math.floor(mission.reward.points * (user.dailyStreak.current * 0.1));
          const missionPoints = mission.reward.points + streakBonus;
          
          // Actualizar usuario
          user.achievementPoints = (user.achievementPoints || 0) + missionPoints;
          user.xp = (user.xp || 0) + mission.reward.xp;
          
          // Marcar como reclamada
          progress.claimed = true;
          progress.claimedAt = new Date();
          await progress.save();
          
          totalPoints += missionPoints;
          totalXp += mission.reward.xp;
          claimedCount++;
          
          Logger.progress('MISIÓN RECLAMADA AUTOMÁTICAMENTE', {
            userId,
            missionId: mission._id.toString(),
            missionTitle: mission.title,
            points: missionPoints,
            xp: mission.reward.xp
          });
        }
      } catch (missionError) {
        Logger.error('ERROR PROCESANDO MISIÓN', missionError, {
          userId,
          missionId: mission._id.toString()
        });
        continue;
      }
    }
    
    // Guardar cambios del usuario
    if (claimedCount > 0) {
      await user.save();
      
      // Verificar si completó todas las misiones del día
      const allClaimed = await UserMissionProgress.find({
        userId,
        date: today,
        claimed: true
      });
      
      if (missions.length === allClaimed.length) {
        Logger.progress('TODAS LAS MISIONES RECLAMADAS', {
          userId,
          totalMissions: missions.length,
          claimedMissions: allClaimed.length
        });
        
        // Actualizar racha
        await exports.updateStreak(userId);
        
        // Verificar bono semanal
        const updatedUser = await User.findById(userId);
        if (updatedUser.dailyStreak.current % 7 === 0 && updatedUser.dailyStreak.current > 0) {
          weeklyBonus = 500;
          updatedUser.achievementPoints += weeklyBonus;
          await updatedUser.save();
          
          Logger.progress('BONO SEMANAL OTORGADO', {
            userId,
            streak: updatedUser.dailyStreak.current,
            weeklyBonus
          });
        }
      }
    }
    
    Logger.progress('VALIDACIÓN Y RECLAMO COMPLETADO', {
      userId,
      claimedCount,
      totalPoints,
      totalXp,
      weeklyBonus
    });
    
    res.json({
      success: claimedCount > 0,
      message: claimedCount > 0 ? `${claimedCount} recompensas reclamadas` : 'No hay recompensas para reclamar',
      claimedCount,
      totalPoints: totalPoints + weeklyBonus,
      totalXp,
      weeklyBonus
    });
  } catch (err) {
    Logger.error('VALIDACIÓN Y RECLAMO MASIVO', err, { userId: req.user.userId });
    res.status(500).json({
      success: false,
      message: 'Error al validar y reclamar recompensas',
      error: err.message
    });
  }
};

// Endpoint para resetear progreso de prueba (solo desarrollo)
exports.resetTestProgress = async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = DateUtils.getStartOfDay();
    
    // Eliminar todo el progreso del usuario de hoy
    const result = await UserMissionProgress.deleteMany({
      userId,
      date: today
    });
    
    Logger.progress('PROGRESO RESET', {
      userId,
      deletedCount: result.deletedCount,
      date: today.toISOString()
    });
    
    res.json({
      success: true,
      message: 'Progreso de prueba reseteado',
      deletedCount: result.deletedCount
    });
  } catch (err) {
    Logger.error('RESET PROGRESO', err, { userId: req.user.userId });
    res.status(500).json({ 
      success: false, 
      message: 'Error reseteando progreso',
      error: err.message 
    });
  }
};
