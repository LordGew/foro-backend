const mongoose = require('mongoose');
const Badge = require('../models/Badge');
require('dotenv').config();

const eventBadges = [
  {
    name: 'Fundador',
    description: 'Miembro fundador de la comunidad',
    icon: '🏛️',
    category: 'event',
    rarity: 'legendary',
    price: 5000,
    requiredLevel: 1,
    stock: -1,
    available: true,
    displayOrder: 1
  },
  {
    name: 'Año Nuevo 2026',
    description: 'Participó en el evento de Año Nuevo 2026',
    icon: '🎆',
    category: 'event',
    rarity: 'epic',
    price: 500,
    requiredLevel: 5,
    stock: -1,
    available: true,
    displayOrder: 2
  },
  {
    name: 'San Valentín',
    description: 'Celebró el amor en la comunidad',
    icon: '💝',
    category: 'event',
    rarity: 'rare',
    price: 300,
    requiredLevel: 3,
    stock: -1,
    available: false,
    displayOrder: 3
  },
  {
    name: 'Halloween Oscuro',
    description: 'Sobrevivió al Halloween más terrorífico',
    icon: '🎃',
    category: 'event',
    rarity: 'epic',
    price: 666,
    requiredLevel: 10,
    stock: -1,
    available: false,
    displayOrder: 4
  },
  {
    name: 'Navidad Mágica',
    description: 'Compartió la magia navideña',
    icon: '🎄',
    category: 'event',
    rarity: 'rare',
    price: 400,
    requiredLevel: 5,
    stock: -1,
    available: false,
    displayOrder: 5
  },
  {
    name: 'Beta Tester',
    description: 'Ayudó a probar nuevas funcionalidades',
    icon: '🧪',
    category: 'event',
    rarity: 'epic',
    price: 1000,
    requiredLevel: 15,
    stock: 100,
    available: true,
    displayOrder: 6
  },
  {
    name: 'Aniversario 1 Año',
    description: 'Celebró el primer aniversario de la comunidad',
    icon: '🎂',
    category: 'event',
    rarity: 'legendary',
    price: 2000,
    requiredLevel: 20,
    stock: -1,
    available: false,
    displayOrder: 7
  }
];

const seedEventBadges = async () => {
  try {
    console.log('🎉 Seeding event badges...');
    
    for (const badge of eventBadges) {
      await Badge.findOneAndUpdate(
        { name: badge.name },
        badge,
        { upsert: true, new: true }
      );
      console.log(`✅ ${badge.name} creado/actualizado`);
    }
    
    console.log('✅ Event badges seeded successfully');
  } catch (err) {
    console.error('❌ Error seeding event badges:', err);
  }
};

module.exports = seedEventBadges;

// Si se ejecuta directamente
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
      await seedEventBadges();
      process.exit(0);
    })
    .catch(err => {
      console.error('Error connecting to MongoDB:', err);
      process.exit(1);
    });
}
