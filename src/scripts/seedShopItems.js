const mongoose = require('mongoose');
const ShopItem = require('../models/ShopItem');
require('dotenv').config();

const shopItems = [
  // Títulos Comunes (50-100 puntos)
  {
    name: 'el Valiente',
    description: 'Un título para aquellos que no temen al peligro',
    type: 'title',
    content: 'el Valiente',
    price: 50,
    rarity: 'common',
    icon: '🛡️',
    requiredLevel: 5
  },
  {
    name: 'el Explorador',
    description: 'Para los aventureros curiosos',
    type: 'title',
    content: 'el Explorador',
    price: 75,
    rarity: 'common',
    icon: '🗺️',
    requiredLevel: 5
  },
  {
    name: 'el Guerrero',
    description: 'Título de combatiente experimentado',
    type: 'title',
    content: 'el Guerrero',
    price: 100,
    rarity: 'common',
    icon: '⚔️',
    requiredLevel: 10
  },
  
  // Títulos Raros (150-250 puntos)
  {
    name: 'Cazador de Dragones',
    description: 'Has enfrentado a las bestias más temibles',
    type: 'title',
    content: 'Cazador de Dragones',
    price: 150,
    rarity: 'rare',
    icon: '🐉',
    requiredLevel: 15
  },
  {
    name: 'Señor de la Guerra',
    description: 'Maestro en el arte del combate',
    type: 'title',
    content: 'Señor de la Guerra',
    price: 200,
    rarity: 'rare',
    icon: '⚔️',
    requiredLevel: 20
  },
  {
    name: 'el Implacable',
    description: 'Nunca te rindes ante ningún desafío',
    type: 'title',
    content: 'el Implacable',
    price: 250,
    rarity: 'rare',
    icon: '💪',
    requiredLevel: 20
  },
  
  // Títulos Épicos (300-500 puntos)
  {
    name: 'Campeón de Azeroth',
    description: 'Héroe reconocido en todo el reino',
    type: 'title',
    content: 'Campeón de Azeroth',
    price: 300,
    rarity: 'epic',
    icon: '👑',
    requiredLevel: 25
  },
  {
    name: 'Asesino del Rey Exánime',
    description: 'Has derrotado al mismísimo Rey Exánime',
    type: 'title',
    content: 'Asesino del Rey Exánime',
    price: 400,
    rarity: 'epic',
    icon: '💀',
    requiredLevel: 30
  },
  {
    name: 'Conquistador de Naxxramas',
    description: 'Has conquistado la fortaleza flotante',
    type: 'title',
    content: 'Conquistador de Naxxramas',
    price: 450,
    rarity: 'epic',
    icon: '🏰',
    requiredLevel: 35
  },
  {
    name: 'Matadragones',
    description: 'Leyenda entre los cazadores de dragones',
    type: 'title',
    content: 'Matadragones',
    price: 500,
    rarity: 'epic',
    icon: '🐲',
    requiredLevel: 35
  },
  
  // Títulos Legendarios (600-1000 puntos)
  {
    name: 'Leyenda Viviente',
    description: 'Tu nombre será recordado por generaciones',
    type: 'title',
    content: 'Leyenda Viviente',
    price: 600,
    rarity: 'legendary',
    icon: '⭐',
    requiredLevel: 40
  },
  {
    name: 'Titán de Azeroth',
    description: 'Poder comparable a los mismos Titanes',
    type: 'title',
    content: 'Titán de Azeroth',
    price: 750,
    rarity: 'legendary',
    icon: '💎',
    requiredLevel: 45
  },
  {
    name: 'Dios de la Guerra',
    description: 'El guerrero definitivo, temido por todos',
    type: 'title',
    content: 'Dios de la Guerra',
    price: 1000,
    rarity: 'legendary',
    icon: '👹',
    requiredLevel: 50
  },
  {
    name: 'Rey/Reina de Azeroth',
    description: 'Gobernante supremo de todo Azeroth',
    type: 'title',
    content: 'Rey de Azeroth',
    price: 1000,
    rarity: 'legendary',
    icon: '👑',
    requiredLevel: 50
  }
];

async function seedShopItems() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    
    const existingCount = await ShopItem.countDocuments();
    
    if (existingCount > 0) {
      console.log(`ℹ️  Ya existen ${existingCount} items en la tienda.`);
      console.log('🔄 Actualizando items existentes...');
      
      for (const item of shopItems) {
        await ShopItem.updateOne(
          { name: item.name },
          { $set: item },
          { upsert: true }
        );
      }
      
      console.log('✅ Items de tienda actualizados');
      await mongoose.disconnect();
      return { updated: true, count: existingCount };
    }
    
    console.log('📦 Creando items de tienda...');
    const inserted = await ShopItem.insertMany(shopItems);
    console.log(`✅ ${inserted.length} items creados exitosamente`);
    
    console.log('\n📊 Resumen por rareza:');
    const rarities = await ShopItem.aggregate([
      { $group: { _id: '$rarity', count: { $sum: 1 } } }
    ]);
    rarities.forEach(r => {
      console.log(`   - ${r._id}: ${r.count} items`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Seed de tienda completado exitosamente');
    return { created: true, count: inserted.length };
  } catch (error) {
    console.error('❌ Error en seed de tienda:', error);
    throw error;
  }
}

if (require.main === module) {
  seedShopItems()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedShopItems;
