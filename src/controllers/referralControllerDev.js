const User = require('../models/User');
const Referral = require('../models/Referral');
const crypto = require('crypto');

/**
 * 🔧 FUNCIONES DE DESARROLLO - SISTEMA DE REFERIDOS
 * 
 * Estas funciones omiten las validaciones de producción para facilitar el desarrollo y testing.
 * 
 * 1. applyReferralCodeDev - Omite validación de IP y tiempo
 * 2. validateReferralDev - Omite requisito de actividad y tiempo
 */

// Generar código de referido único
const generateReferralCode = async () => {
  let code;
  let exists = true;
  
  while (exists) {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const user = await User.findOne({ referralCode: code });
    exists = !!user;
  }
  
  return code;
};

/**
 * FUNCIÓN DE DESARROLLO 1:
 * Aplicar código de referido SIN validación de IP y con recompensa inmediata
 */
exports.applyReferralCodeDev = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    if (user.referredBy) {
      return res.status(400).json({ message: 'Ya has usado un código de referido' });
    }
    
    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(404).json({ message: 'Código de referido inválido' });
    }
    
    if (referrer._id.toString() === userId) {
      return res.status(400).json({ message: 'No puedes usar tu propio código de referido' });
    }
    
    // 🔥 DESARROLLO: OMITIR VALIDACIÓN DE IP
    // No verificamos si es la misma IP
    
    // Verificar que no exista ya este referido
    const existingReferral = await Referral.findOne({
      referrer: referrer._id,
      referred: userId
    });
    
    if (existingReferral) {
      return res.status(400).json({ message: 'Ya has sido referido por este usuario' });
    }
    
    // 🔥 DESARROLLO: CREAR REFERIDO COMO COMPLETADO INMEDIATAMENTE
    const referral = new Referral({
      referrer: referrer._id,
      referred: userId,
      referralCode: referralCode,
      pointsAwarded: 100,
      status: 'completed', // 🔥 CAMBIO: Completado inmediatamente
      completedAt: new Date() // 🔥 CAMBIO: Completado ahora
    });
    
    await referral.save();
    
    // Actualizar usuario referido
    user.referredBy = referrer._id;
    
    // 🔥 DESARROLLO: DAR PUNTOS INMEDIATOS A AMBOS
    // 50 puntos al nuevo usuario
    user.referralPoints = (user.referralPoints || 0) + 50;
    await user.save();
    
    // 100 puntos al referidor inmediatamente
    referrer.referralPoints = (referrer.referralPoints || 0) + 100;
    referrer.totalReferrals += 1;
    await referrer.save();
    
    // Emitir notificación de completado (en lugar de pendiente)
    if (req.io) {
      req.io.to(referrer._id.toString()).emit('referralCompleted', {
        referredUser: user.username,
        pointsEarned: 100,
        message: '¡Referido completado inmediatamente (modo desarrollo)!'
      });
    }
    
    res.json({
      message: '🔥 MODO DESARROLLO: ¡Referido completado inmediatamente! Ambos han recibido sus puntos.',
      mode: 'development',
      status: 'completed',
      pointsReceived: {
        referred: 50,
        referrer: 100
      },
      referral: {
        id: referral._id,
        status: referral.status,
        completedAt: referral.completedAt
      },
      referrer: {
        username: referrer.username,
        _id: referrer._id
      },
      developmentNotes: {
        ipValidationSkipped: true,
        timeRequirementSkipped: true,
        activityRequirementSkipped: true,
        immediateCompletion: true
      }
    });
  } catch (err) {
    console.error('Error applying referral code (DEV):', err);
    res.status(500).json({ message: 'Error al aplicar código de referido (DEV)', error: err.message });
  }
};

/**
 * FUNCIÓN DE DESARROLLO 2:
 * Validar referido específico SIN requisitos de tiempo ni actividad
 */
exports.validateReferralDev = async (req, res) => {
  try {
    const { referralId } = req.params;
    const userId = req.user.userId; // Admin o el propio referidor
    
    const referral = await Referral.findById(referralId)
      .populate('referrer')
      .populate('referred');
    
    if (!referral) {
      return res.status(404).json({ message: 'Referido no encontrado' });
    }
    
    // 🔥 DESARROLLO: PERMITIR VALIDACIÓN SIN REQUISITOS
    if (referral.status === 'completed') {
      return res.status(400).json({ message: 'Este referido ya está completado' });
    }
    
    // 🔥 DESARROLLO: COMPLETAR SIN VERIFICAR REQUISITOS
    referral.status = 'completed';
    referral.completedAt = new Date();
    await referral.save();
    
    // 🔥 DESARROLLO: ACREDITAR PUNTOS INMEDIATAMENTE
    if (referral.referrer) {
      referral.referrer.referralPoints += referral.pointsAwarded;
      await referral.referrer.save();
    }
    
    // Emitir notificación
    if (req.io && referral.referrer) {
      req.io.to(referral.referrer._id.toString()).emit('referralCompleted', {
        referredUser: referral.referred.username,
        pointsEarned: referral.pointsAwarded,
        message: '¡Referido validado inmediatamente (modo desarrollo)!'
      });
    }
    
    res.json({
      message: '🔥 MODO DESARROLLO: Referido validado inmediatamente sin requisitos',
      mode: 'development',
      referral: {
        id: referral._id,
        status: referral.status,
        completedAt: referral.completedAt,
        pointsAwarded: referral.pointsAwarded
      },
      referrer: {
        username: referral.referrer?.username,
        pointsEarned: referral.pointsAwarded,
        totalPoints: referral.referrer?.referralPoints
      },
      developmentNotes: {
        timeRequirementSkipped: true,
        activityRequirementSkipped: true,
        ipValidationSkipped: true,
        immediateValidation: true
      }
    });
  } catch (err) {
    console.error('Error validating referral (DEV):', err);
    res.status(500).json({ message: 'Error al validar referido (DEV)', error: err.message });
  }
};

/**
 * FUNCIÓN DE DESARROLLO 3:
 * Obtener código de referido con modo de desarrollo activado
 */
exports.getMyReferralCodeDev = async (req, res) => {
  try {
    const userId = req.user.userId;
    let user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    if (!user.referralCode) {
      user.referralCode = await generateReferralCode();
      await user.save();
    }
    
    res.json({
      message: '🔥 MODO DESARROLLO: Código obtenido con funciones especiales',
      mode: 'development',
      referralCode: user.referralCode,
      referralLink: `${process.env.FRONTEND_URL}/register?ref=${user.referralCode}`,
      totalReferrals: user.totalReferrals,
      referralPoints: user.referralPoints,
      developmentFeatures: {
        immediateRewards: true,
        noIpValidation: true,
        noTimeRequirement: true,
        noActivityRequirement: true
      }
    });
  } catch (err) {
    console.error('Error getting referral code (DEV):', err);
    res.status(500).json({ message: 'Error al obtener código de referido (DEV)', error: err.message });
  }
};

/**
 * FUNCIÓN DE DESARROLLO 4:
 * Resetear todos los referidos de un usuario (para testing)
 */
exports.resetMyReferralsDev = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Eliminar todos los referidos donde este usuario es el referidor
    const deletedReferrals = await Referral.deleteMany({ referrer: userId });
    
    // Resetear contadores del usuario
    const user = await User.findById(userId);
    if (user) {
      user.totalReferrals = 0;
      user.referralPoints = 0;
      await user.save();
    }
    
    res.json({
      message: '🔥 MODO DESARROLLO: Todos tus referidos han sido eliminados',
      mode: 'development',
      deletedCount: deletedReferrals.deletedCount,
      userStats: {
        totalReferrals: 0,
        referralPoints: 0
      }
    });
  } catch (err) {
    console.error('Error resetting referrals (DEV):', err);
    res.status(500).json({ message: 'Error al resetear referidos (DEV)', error: err.message });
  }
};

/**
 * FUNCIÓN DE DESARROLLO 5:
 * Crear usuarios de prueba con referidos automáticos
 */
exports.createTestUsersWithReferrals = async (req, res) => {
  try {
    const { count = 2 } = req.body;
    const createdUsers = [];
    const createdReferrals = [];
    
    for (let i = 0; i < count; i++) {
      // Crear usuario de prueba
      const testUser = new User({
        username: `testuser${Date.now()}${i}`,
        email: `test${Date.now()}${i}@example.com`,
        password: 'test123456',
        referralCode: await generateReferralCode(),
        referralPoints: 0,
        totalReferrals: 0,
        isActive: true
      });
      
      await testUser.save();
      createdUsers.push(testUser);
      
      // Si no es el primero, crear referido
      if (i > 0) {
        const referral = new Referral({
          referrer: createdUsers[0]._id,
          referred: testUser._id,
          referralCode: createdUsers[0].referralCode,
          pointsAwarded: 100,
          status: 'completed',
          completedAt: new Date()
        });
        
        await referral.save();
        createdReferrals.push(referral);
        
        // Actualizar puntos
        createdUsers[0].referralPoints += 100;
        createdUsers[0].totalReferrals += 1;
        testUser.referralPoints += 50;
        testUser.referredBy = createdUsers[0]._id;
        
        await createdUsers[0].save();
        await testUser.save();
      }
    }
    
    res.json({
      message: '🔥 MODO DESARROLLO: Usuarios de prueba creados con referidos',
      mode: 'development',
      createdUsers: createdUsers.map(u => ({
        id: u._id,
        username: u.username,
        email: u.email,
        referralCode: u.referralCode,
        referralPoints: u.referralPoints,
        totalReferrals: u.totalReferrals
      })),
      createdReferrals: createdReferrals.map(r => ({
        id: r._id,
        status: r.status,
        pointsAwarded: r.pointsAwarded
      }))
    });
  } catch (err) {
    console.error('Error creating test users (DEV):', err);
    res.status(500).json({ message: 'Error al crear usuarios de prueba (DEV)', error: err.message });
  }
};

module.exports = exports;
