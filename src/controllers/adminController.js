const AdminSettings = require('../models/AdminSettings');
const User = require('../models/User');
const Category = require('../models/Category');
const Game = require('../models/Game');

const updateForumSettings = async (req, res) => {
  try {
    const { forumName, language, theme } = req.body;
    const settings = await AdminSettings.findOneAndUpdate(
      {}, 
      { forumName, language, theme }, 
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      settings
    });
  } catch (err) {
    console.error('Error al actualizar configuración:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getForumSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.findOne() || { 
      forumName: 'WoW Forum', 
      language: 'EN', 
      theme: 'default' 
    };
    
    res.json({
      success: true,
      settings
    });
  } catch (err) {
    console.error('Error al obtener configuración:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Formatear usuarios para el frontend
    const formattedUsers = users.map(user => ({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      xp: user.xp,
      profileImage: user.profileImage || '', // Devolver sin concatenar, solo Cloudinary o ''
      banned: user.banned || false,
      muted: user.muted || false,
      banReason: user.banReason,
      banExpires: user.banExpires,
      vip: user.vip || false,
      vipExpiresAt: user.vipExpiresAt || null,
      vipTier: user.vipTier || 'none',
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));

    res.json(formattedUsers);
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: err.message 
    });
  }
};

// Aplicar referido manualmente a un usuario específico
const applyManualReferral = async (req, res) => {
  try {
    const { referredUsername, referrerUsername } = req.body;
    
    if (!referredUsername || !referrerUsername) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren referredUsername y referrerUsername'
      });
    }
    
    const Referral = require('../models/Referral');
    
    // Buscar usuarios
    const referred = await User.findOne({ username: referredUsername });
    const referrer = await User.findOne({ username: referrerUsername });
    
    if (!referred) {
      return res.status(404).json({
        success: false,
        message: `Usuario referido "${referredUsername}" no encontrado`
      });
    }
    
    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: `Usuario referidor "${referrerUsername}" no encontrado`
      });
    }
    
    // Verificar si ya existe el referido
    const existingReferral = await Referral.findOne({
      referrer: referrer._id,
      referred: referred._id
    });
    
    if (existingReferral) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un referido entre estos usuarios',
        referral: existingReferral
      });
    }
    
    // Crear referido en estado PENDING
    const referral = new Referral({
      referrer: referrer._id,
      referred: referred._id,
      referralCode: referrer.referralCode || 'MANUAL',
      pointsAwarded: 100,
      status: 'pending',
      completedAt: null
    });
    
    await referral.save();
    
    // Dar 50 puntos al usuario referido
    referred.referralPoints = (referred.referralPoints || 0) + 50;
    referred.referredBy = referrer._id;
    await referred.save();
    
    // Actualizar contador del referidor
    referrer.totalReferrals += 1;
    await referrer.save();
    
    console.log(`✅ Referido manual aplicado: ${referredUsername} -> ${referrerUsername}`);
    
    res.json({
      success: true,
      message: `Referido aplicado exitosamente. ${referredUsername} recibió 50 puntos. ${referrerUsername} recibirá 100 puntos cuando se cumplan requisitos.`,
      referral: {
        referred: referredUsername,
        referrer: referrerUsername,
        pointsGivenToReferred: 50,
        pointsPendingForReferrer: 100,
        status: 'pending'
      }
    });
  } catch (err) {
    console.error('Error al aplicar referido manual:', err);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: err.message
    });
  }
};

const fixCategoriesGame = async (req, res) => {
  try {
    console.log(' Iniciando reparación de categorías sin juego...');
    
    // Buscar el juego World of Warcraft
    const wowGame = await Game.findOne({ name: 'World of Warcraft' });
    
    if (!wowGame) {
      console.error(' No se encontró el juego "World of Warcraft"');
      const allGames = await Game.find({});
      return res.status(404).json({
        success: false,
        message: 'No se encontró el juego "World of Warcraft"',
        availableGames: allGames.map(g => ({ id: g._id, name: g.name }))
      });
    }
    
    console.log(` Juego encontrado: ${wowGame.name} (ID: ${wowGame._id})`);
    
    // Buscar categorías sin juego asignado
    const categoriesWithoutGame = await Category.find({
      $or: [
        { game: null },
        { game: { $exists: false } }
      ]
    });
    
    console.log(` Categorías sin juego: ${categoriesWithoutGame.length}`);
    
    if (categoriesWithoutGame.length === 0) {
      const allCategories = await Category.find({}).populate('game', 'name');
      return res.json({
        success: true,
        message: 'Todas las categorías ya tienen un juego asignado',
        categories: allCategories.map(cat => ({
          name: cat.name,
          game: cat.game ? cat.game.name : 'SIN JUEGO'
        }))
      });
    }
    
    // Actualizar categorías sin juego
    const result = await Category.updateMany(
      {
        $or: [
          { game: null },
          { game: { $exists: false } }
        ]
      },
      {
        $set: { game: wowGame._id }
      }
    );
    
    console.log(` Actualización completada: ${result.modifiedCount} categorías actualizadas`);
    
    // Verificar resultado
    const updatedCategories = await Category.find({}).populate('game', 'name');
    
    res.json({
      success: true,
      message: `Se asignó el juego "${wowGame.name}" a ${result.modifiedCount} categorías`,
      updatedCount: result.modifiedCount,
      categories: updatedCategories.map(cat => ({
        name: cat.name,
        game: cat.game ? cat.game.name : 'SIN JUEGO'
      }))
    });
    
  } catch (err) {
    console.error(' Error al reparar categorías:', err);
    res.status(500).json({
      success: false,
      message: 'Error al reparar categorías',
      error: err.message
    });
  }
};

// Migrar roles antiguos a nuevos
const migrateRoles = async (req, res) => {
  try {
    console.log(' Iniciando migración de roles...');
    
    // Mapeo de roles antiguos a nuevos
    const roleMapping = {
      'Player': 'player',
      'GameMaster': 'gamemaster',
      'Admin': 'admin'
    };
    
    let migratedCount = 0;
    
    // Buscar usuarios con roles antiguos
    for (const [oldRole, newRole] of Object.entries(roleMapping)) {
      const result = await User.updateMany(
        { role: oldRole },
        { $set: { role: newRole } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(` Migrados ${result.modifiedCount} usuarios de "${oldRole}" a "${newRole}"`);
        migratedCount += result.modifiedCount;
      }
    }
    
    // Verificar resultado
    const roleCounts = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log(' Distribución de roles después de la migración:', roleCounts);
    
    res.json({
      success: true,
      message: `Migración completada: ${migratedCount} usuarios actualizados`,
      migratedCount,
      currentRoles: roleCounts
    });
    
  } catch (err) {
    console.error(' Error en migración de roles:', err);
    res.status(500).json({
      success: false,
      message: 'Error al migrar roles',
      error: err.message
    });
  }
};

// Gestionar VIP de un usuario manualmente
const manageUserVip = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, duration, tier } = req.body;
    // action: 'activate' | 'deactivate' | 'lifetime'
    // duration: número de días (solo para 'activate')
    // tier: 'basic' | 'premium' | 'lifetime' (opcional)

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (action === 'activate') {
      const days = parseInt(duration) || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      user.vip = true;
      user.vipExpiresAt = expiresAt;
      user.vipTier = tier || 'basic';
      await user.save();

      console.log(`👑 VIP activado para ${user.username}: ${days} días, tier: ${user.vipTier}`);
      return res.json({
        message: `VIP activado para ${user.username} por ${days} días`,
        user: {
          _id: user._id,
          username: user.username,
          vip: user.vip,
          vipExpiresAt: user.vipExpiresAt,
          vipTier: user.vipTier
        }
      });
    }

    if (action === 'lifetime') {
      user.vip = true;
      user.vipExpiresAt = null; // null = vitalicio
      user.vipTier = 'lifetime';
      await user.save();

      console.log(`👑 VIP vitalicio activado para ${user.username}`);
      return res.json({
        message: `VIP vitalicio activado para ${user.username}`,
        user: {
          _id: user._id,
          username: user.username,
          vip: user.vip,
          vipExpiresAt: user.vipExpiresAt,
          vipTier: user.vipTier
        }
      });
    }

    if (action === 'deactivate') {
      user.vip = false;
      user.vipExpiresAt = null;
      user.vipTier = 'none';
      await user.save();

      console.log(`❌ VIP desactivado para ${user.username}`);
      return res.json({
        message: `VIP desactivado para ${user.username}`,
        user: {
          _id: user._id,
          username: user.username,
          vip: user.vip,
          vipExpiresAt: user.vipExpiresAt,
          vipTier: user.vipTier
        }
      });
    }

    return res.status(400).json({ message: 'Acción inválida. Usa: activate, deactivate o lifetime' });

  } catch (err) {
    console.error('Error al gestionar VIP:', err);
    res.status(500).json({ message: 'Error al gestionar VIP', error: err.message });
  }
};

module.exports = { 
  updateForumSettings, 
  getForumSettings, 
  getUsers,
  fixCategoriesGame,
  applyManualReferral,
  migrateRoles,
  manageUserVip
};