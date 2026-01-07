const Badge = require('../models/Badge');
const User = require('../models/User');

// Obtener todos los badges disponibles con filtros
exports.getAllBadges = async (req, res) => {
  try {
    const { category, rarity, sort = 'price' } = req.query;
    
    const filter = { available: true };
    if (category) filter.category = category;
    if (rarity) filter.rarity = rarity;
    
    let sortOption = {};
    switch (sort) {
      case 'price_asc':
        sortOption = { price: 1 };
        break;
      case 'price_desc':
        sortOption = { price: -1 };
        break;
      case 'rarity':
        sortOption = { rarity: -1, price: 1 };
        break;
      case 'name':
        sortOption = { name: 1 };
        break;
      default:
        sortOption = { displayOrder: 1, price: 1 };
    }
    
    const badges = await Badge.find(filter).sort(sortOption);
    
    res.json({
      success: true,
      badges,
      total: badges.length
    });
  } catch (err) {
    console.error('Error al obtener badges:', err);
    res.status(500).json({ message: 'Error al cargar badges', error: err.message });
  }
};

// Comprar un badge
exports.purchaseBadge = async (req, res) => {
  try {
    const { badgeId } = req.params;
    const userId = req.user.userId;
    
    const badge = await Badge.findById(badgeId);
    if (!badge) {
      return res.status(404).json({ message: 'Badge no encontrado' });
    }
    
    if (!badge.available) {
      return res.status(400).json({ message: 'Este badge no está disponible' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Verificar si ya tiene el badge
    if (user.badges && user.badges.includes(badgeId)) {
      return res.status(400).json({ message: 'Ya posees este badge' });
    }
    
    // Verificar puntos suficientes
    if (user.achievementPoints < badge.price) {
      return res.status(400).json({ 
        message: `Puntos insuficientes. Necesitas ${badge.price} puntos, tienes ${user.achievementPoints}` 
      });
    }
    
    // Verificar nivel requerido
    const userLevel = Math.floor(Math.sqrt(user.xp / 10));
    if (userLevel < badge.requiredLevel) {
      return res.status(400).json({ 
        message: `Nivel insuficiente. Necesitas nivel ${badge.requiredLevel}, tienes nivel ${userLevel}` 
      });
    }
    
    // Verificar logro requerido si existe
    if (badge.requiredAchievement) {
      const hasAchievement = user.achievements && user.achievements.some(
        a => a.achievementId && a.achievementId.toString() === badge.requiredAchievement.toString() && a.unlockedAt
      );
      if (!hasAchievement) {
        return res.status(400).json({ 
          message: 'No cumples con el logro requerido para este badge' 
        });
      }
    }
    
    // Verificar stock
    if (badge.stock !== -1 && badge.stock <= 0) {
      return res.status(400).json({ message: 'Badge agotado' });
    }
    
    // Realizar la compra
    user.achievementPoints -= badge.price;
    if (!user.badges) user.badges = [];
    user.badges.push(badgeId);
    await user.save();
    
    // Actualizar estadísticas del badge
    badge.purchaseCount += 1;
    if (badge.stock !== -1) {
      badge.stock -= 1;
    }
    await badge.save();
    
    res.json({
      success: true,
      message: `Badge "${badge.name}" comprado exitosamente`,
      badge,
      remainingPoints: user.achievementPoints,
      totalBadges: user.badges.length
    });
  } catch (err) {
    console.error('Error al comprar badge:', err);
    res.status(500).json({ message: 'Error al comprar badge', error: err.message });
  }
};

// Obtener badges del usuario
exports.getUserBadges = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
    
    const user = await User.findById(userId).populate('badges');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json({
      success: true,
      badges: user.badges || [],
      total: user.badges ? user.badges.length : 0
    });
  } catch (err) {
    console.error('Error al obtener badges del usuario:', err);
    res.status(500).json({ message: 'Error al cargar badges', error: err.message });
  }
};

// ADMIN: Crear badge
exports.createBadge = async (req, res) => {
  try {
    const badge = new Badge(req.body);
    await badge.save();
    
    res.status(201).json({
      success: true,
      message: 'Badge creado exitosamente',
      badge
    });
  } catch (err) {
    console.error('Error al crear badge:', err);
    res.status(500).json({ message: 'Error al crear badge', error: err.message });
  }
};

// ADMIN: Actualizar badge
exports.updateBadge = async (req, res) => {
  try {
    const { badgeId } = req.params;
    const badge = await Badge.findByIdAndUpdate(badgeId, req.body, { new: true });
    
    if (!badge) {
      return res.status(404).json({ message: 'Badge no encontrado' });
    }
    
    res.json({
      success: true,
      message: 'Badge actualizado exitosamente',
      badge
    });
  } catch (err) {
    console.error('Error al actualizar badge:', err);
    res.status(500).json({ message: 'Error al actualizar badge', error: err.message });
  }
};

// ADMIN: Eliminar badge
exports.deleteBadge = async (req, res) => {
  try {
    const { badgeId } = req.params;
    const badge = await Badge.findByIdAndDelete(badgeId);
    
    if (!badge) {
      return res.status(404).json({ message: 'Badge no encontrado' });
    }
    
    res.json({
      success: true,
      message: 'Badge eliminado exitosamente'
    });
  } catch (err) {
    console.error('Error al eliminar badge:', err);
    res.status(500).json({ message: 'Error al eliminar badge', error: err.message });
  }
};
