const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const RewardItem = require('../models/RewardItem');

/**
 * Obtener todos los items de la tienda
 */
exports.getAllShopItems = async (req, res) => {
  try {
    const { type, rarity, minPrice, maxPrice } = req.query;
    
    let filter = { isAvailable: true };
    
    if (type) filter.type = type;
    if (rarity) filter.rarity = rarity;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }
    
    const items = await ShopItem.find(filter)
      .populate('requiredAchievement')
      .sort({ rarity: -1, price: 1 });
    
    res.json({
      items,
      total: items.length
    });
  } catch (err) {
    console.error('Error getting shop items:', err);
    res.status(500).json({ message: 'Error al obtener items de la tienda', error: err.message });
  }
};

/**
 * Comprar un item de la tienda
 */
exports.purchaseShopItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const shopItem = await ShopItem.findById(itemId).populate('requiredAchievement');
    if (!shopItem) {
      return res.status(404).json({ message: 'Item no encontrado' });
    }
    
    if (!shopItem.isAvailable) {
      return res.status(400).json({ message: 'Este item no está disponible' });
    }
    
    // Verificar nivel requerido
    const userLevel = Math.floor(Math.sqrt(user.xp / 10)) + 1;
    if (userLevel < shopItem.requiredLevel) {
      return res.status(403).json({ 
        message: `Necesitas nivel ${shopItem.requiredLevel} para comprar este item`,
        requiredLevel: shopItem.requiredLevel,
        currentLevel: userLevel
      });
    }
    
    // Verificar logro requerido
    if (shopItem.requiredAchievement) {
      const hasAchievement = user.achievements.some(
        a => a.achievementId.toString() === shopItem.requiredAchievement._id.toString()
      );
      if (!hasAchievement) {
        return res.status(403).json({ 
          message: `Necesitas el logro "${shopItem.requiredAchievement.name}" para comprar este item`,
          requiredAchievement: shopItem.requiredAchievement.name
        });
      }
    }
    
    // Verificar puntos suficientes
    if (user.achievementPoints < shopItem.price) {
      return res.status(400).json({ 
        message: 'No tienes suficientes puntos de logros',
        required: shopItem.price,
        current: user.achievementPoints
      });
    }
    
    // Verificar stock
    if (shopItem.stock !== -1 && shopItem.stock <= 0) {
      return res.status(400).json({ message: 'Este item está agotado' });
    }
    
    // Verificar si ya tiene el item
    const existingReward = await RewardItem.findOne({ 
      name: shopItem.name,
      type: shopItem.type,
      content: shopItem.content
    });
    
    let rewardItem;
    if (existingReward) {
      rewardItem = existingReward;
      // Verificar si el usuario ya lo tiene
      const alreadyOwned = user.ownedRewards.some(
        r => r.rewardId.toString() === rewardItem._id.toString()
      );
      if (alreadyOwned) {
        return res.status(400).json({ message: 'Ya tienes este item' });
      }
    } else {
      // Crear nuevo RewardItem
      rewardItem = new RewardItem({
        name: shopItem.name,
        description: shopItem.description,
        type: shopItem.type,
        content: shopItem.content,
        rarity: shopItem.rarity,
        iconHtml: shopItem.icon
      });
      await rewardItem.save();
    }
    
    // Realizar la compra
    user.achievementPoints -= shopItem.price;
    user.ownedRewards.push({
      rewardId: rewardItem._id,
      unlockedAt: new Date()
    });
    
    await user.save();
    
    // Actualizar estadísticas del item
    shopItem.purchaseCount += 1;
    if (shopItem.stock !== -1) {
      shopItem.stock -= 1;
    }
    await shopItem.save();
    res.json({
      message: 'Compra realizada exitosamente',
      item: shopItem,
      reward: rewardItem,
      remainingPoints: user.achievementPoints
    });
  } catch (err) {
    console.error('Error purchasing shop item:', err);
    res.status(500).json({ message: 'Error al comprar item', error: err.message });
  }
};

/**
 * Crear item de tienda (Admin)
 */
exports.createShopItem = async (req, res) => {
  try {
    const itemData = req.body;
    
    const shopItem = new ShopItem(itemData);
    await shopItem.save();
    
    res.status(201).json({
      message: 'Item creado exitosamente',
      item: shopItem
    });
  } catch (err) {
    console.error('Error creating shop item:', err);
    res.status(500).json({ message: 'Error al crear item', error: err.message });
  }
};

/**
 * Actualizar item de tienda (Admin)
 */
exports.updateShopItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const updateData = req.body;
    
    const shopItem = await ShopItem.findByIdAndUpdate(
      itemId,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!shopItem) {
      return res.status(404).json({ message: 'Item no encontrado' });
    }
    
    res.json({
      message: 'Item actualizado exitosamente',
      item: shopItem
    });
  } catch (err) {
    console.error('Error updating shop item:', err);
    res.status(500).json({ message: 'Error al actualizar item', error: err.message });
  }
};

/**
 * Eliminar item de tienda (Admin)
 */
exports.deleteShopItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const shopItem = await ShopItem.findByIdAndUpdate(
      itemId,
      { isAvailable: false },
      { new: true }
    );
    
    if (!shopItem) {
      return res.status(404).json({ message: 'Item no encontrado' });
    }
    
    res.json({
      message: 'Item desactivado exitosamente',
      item: shopItem
    });
  } catch (err) {
    console.error('Error deleting shop item:', err);
    res.status(500).json({ message: 'Error al eliminar item', error: err.message });
  }
};
