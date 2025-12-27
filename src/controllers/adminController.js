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

module.exports = { 
  updateForumSettings, 
  getForumSettings, 
  getUsers,
  fixCategoriesGame
};