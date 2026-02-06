const Game = require('../models/Game');
const Category = require('../models/Category');
const slugify = require('slugify');

// Obtener todos los juegos activos
exports.getAllGames = async (req, res) => {
  try {
    const games = await Game.find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .select('-__v');
    
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ message: 'Error al obtener juegos' });
  }
};

// Obtener un juego por slug
exports.getGameBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const game = await Game.findOne({ slug, isActive: true });
    
    if (!game) {
      return res.status(404).json({ message: 'Juego no encontrado' });
    }
    
    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ message: 'Error al obtener juego' });
  }
};

// Obtener categorías de un juego
exports.getGameCategories = async (req, res) => {
  try {
    const { slug } = req.params;
    const game = await Game.findOne({ slug, isActive: true });
    
    if (!game) {
      return res.status(404).json({ message: 'Juego no encontrado' });
    }
    
    const categories = await Category.find({ game: game._id, isActive: true })
      .sort({ order: 1, name: 1 })
      .select('-__v');
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching game categories:', error);
    res.status(500).json({ message: 'Error al obtener categorías' });
  }
};

// ADMIN: Crear un nuevo juego
exports.createGame = async (req, res) => {
  try {
    const { name, description, icon, bannerImage, color } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }
    
    const slug = slugify(name, { lower: true, strict: true });
    
    // Verificar si ya existe
    const existingGame = await Game.findOne({ slug });
    if (existingGame) {
      return res.status(400).json({ message: 'Ya existe un juego con ese nombre' });
    }
    
    // Obtener el orden más alto
    const lastGame = await Game.findOne().sort({ order: -1 });
    const order = lastGame ? lastGame.order + 1 : 0;
    
    const game = new Game({
      name,
      slug,
      description: description || '',
      icon: icon || '🎮',
      bannerImage: bannerImage || '',
      color: color || '#8E2DE2',
      order
    });
    
    await game.save();
    
    // Crear automáticamente una categoría "General" para el nuevo juego
    try {
      const generalCategory = new Category({
        name: 'General',
        description: `Categoría general para ${name}`,
        icon: '💬',
        game: game._id,
        order: 0
      });
      await generalCategory.save();
    } catch (categoryError) {
      console.error('⚠️ Error al crear categoría automática:', categoryError);
      // No fallar la creación del juego si falla la categoría
    }
    
    res.status(201).json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ message: 'Error al crear juego' });
  }
};

// ADMIN: Actualizar un juego
exports.updateGame = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, bannerImage, color, isActive, order } = req.body;
    
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ message: 'Juego no encontrado' });
    }
    
    // Si se cambia el nombre, actualizar el slug
    if (name && name !== game.name) {
      const newSlug = slugify(name, { lower: true, strict: true });
      const existingGame = await Game.findOne({ slug: newSlug, _id: { $ne: id } });
      if (existingGame) {
        return res.status(400).json({ message: 'Ya existe un juego con ese nombre' });
      }
      game.slug = newSlug;
      game.name = name;
    }
    
    if (description !== undefined) game.description = description;
    if (icon !== undefined) game.icon = icon;
    if (bannerImage !== undefined) game.bannerImage = bannerImage;
    if (color !== undefined) game.color = color;
    if (isActive !== undefined) game.isActive = isActive;
    if (order !== undefined) game.order = order;
    
    await game.save();
    res.json(game);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ message: 'Error al actualizar juego' });
  }
};

// ADMIN: Eliminar un juego (soft delete)
exports.deleteGame = async (req, res) => {
  try {
    const { id } = req.params;
    
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ message: 'Juego no encontrado' });
    }
    
    // Verificar si tiene categorías asociadas
    const categoriesCount = await Category.countDocuments({ game: id });
    if (categoriesCount > 0) {
      return res.status(400).json({ 
        message: `No se puede eliminar el juego porque tiene ${categoriesCount} categorías asociadas. Elimina las categorías primero.` 
      });
    }
    
    game.isActive = false;
    await game.save();
    
    res.json({ message: 'Juego desactivado exitosamente' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ message: 'Error al eliminar juego' });
  }
};

// ADMIN: Reordenar juegos
exports.reorderGames = async (req, res) => {
  try {
    const { gameIds } = req.body; // Array de IDs en el nuevo orden
    
    if (!Array.isArray(gameIds)) {
      return res.status(400).json({ message: 'Se requiere un array de IDs' });
    }
    
    // Actualizar el orden de cada juego
    const updatePromises = gameIds.map((id, index) => 
      Game.findByIdAndUpdate(id, { order: index })
    );
    
    await Promise.all(updatePromises);
    
    res.json({ message: 'Orden actualizado exitosamente' });
  } catch (error) {
    console.error('Error reordering games:', error);
    res.status(500).json({ message: 'Error al reordenar juegos' });
  }
};

// ADMIN: Crear categoría para un juego
exports.createGameCategory = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { name, description, icon } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }
    
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Juego no encontrado' });
    }
    
    // Verificar si ya existe una categoría con ese nombre para este juego
    const existingCategory = await Category.findOne({ name, game: gameId });
    if (existingCategory) {
      return res.status(400).json({ message: 'Ya existe una categoría con ese nombre para este juego' });
    }
    
    // Obtener el orden más alto para este juego
    const lastCategory = await Category.findOne({ game: gameId }).sort({ order: -1 });
    const order = lastCategory ? lastCategory.order + 1 : 0;
    
    const category = new Category({
      name,
      description: description || '',
      icon: icon || '📁',
      game: gameId,
      order
    });
    
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error al crear categoría' });
  }
};

// ADMIN: Actualizar categoría
exports.updateGameCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description, icon, isActive, order } = req.body;
    
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    
    // Si se cambia el nombre, verificar que no exista otra con ese nombre en el mismo juego
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ 
        name, 
        game: category.game, 
        _id: { $ne: categoryId } 
      });
      if (existingCategory) {
        return res.status(400).json({ message: 'Ya existe una categoría con ese nombre para este juego' });
      }
      category.name = name;
    }
    
    if (description !== undefined) category.description = description;
    if (icon !== undefined) category.icon = icon;
    if (isActive !== undefined) category.isActive = isActive;
    if (order !== undefined) category.order = order;
    
    await category.save();
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error al actualizar categoría' });
  }
};

// ADMIN: Eliminar categoría
exports.deleteGameCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    
    // Verificar si tiene posts asociados
    const Post = require('../models/Post');
    const postsCount = await Post.countDocuments({ category: categoryId });
    if (postsCount > 0) {
      return res.status(400).json({ 
        message: `No se puede eliminar la categoría porque tiene ${postsCount} posts asociados.` 
      });
    }
    
    await category.deleteOne();
    res.json({ message: 'Categoría eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error al eliminar categoría' });
  }
};

module.exports = exports;
