const mongoose = require('mongoose');
const Achievement = require('../models/Achievement');
require('dotenv').config();

const streakAchievements = [
  {
    name: 'Racha de Fuego',
    description: 'Mantén una racha de 7 días consecutivos',
    icon: '🔥',
    category: 'streak',
    rarity: 'rare',
    points: 200,
    requirement: {
      type: 'streak',
      value: 7
    }
  },
  {
    name: 'Dedicación Inquebrantable',
    description: 'Mantén una racha de 14 días consecutivos',
    icon: '💪',
    category: 'streak',
    rarity: 'epic',
    points: 500,
    requirement: {
      type: 'streak',
      value: 14
    }
  },
  {
    name: 'Maestro de la Constancia',
    description: 'Mantén una racha de 30 días consecutivos',
    icon: '👑',
    category: 'streak',
    rarity: 'legendary',
    points: 1000,
    requirement: {
      type: 'streak',
      value: 30
    }
  },
  {
    name: 'Leyenda Eterna',
    description: 'Mantén una racha de 100 días consecutivos',
    icon: '⭐',
    category: 'streak',
    rarity: 'legendary',
    points: 3000,
    requirement: {
      type: 'streak',
      value: 100
    }
  }
];

const seedStreakAchievements = async () => {
  try {
    console.log('🔥 Seeding streak achievements...');
    
    for (const achievement of streakAchievements) {
      await Achievement.findOneAndUpdate(
        { name: achievement.name },
        achievement,
        { upsert: true, new: true }
      );
      console.log(`✅ ${achievement.name} creado/actualizado`);
    }
    
    console.log('✅ Streak achievements seeded successfully');
  } catch (err) {
    console.error('❌ Error seeding streak achievements:', err);
  }
};

module.exports = seedStreakAchievements;

// Si se ejecuta directamente
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
      await seedStreakAchievements();
      process.exit(0);
    })
    .catch(err => {
      console.error('Error connecting to MongoDB:', err);
      process.exit(1);
    });
}
