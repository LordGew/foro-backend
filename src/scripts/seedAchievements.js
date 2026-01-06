const mongoose = require('mongoose');
const Achievement = require('../models/Achievement');
const RewardItem = require('../models/RewardItem');
require('dotenv').config();

const achievements = [
  // Logros de Nivel/XP
  {
    name: 'Primer Paso',
    description: 'Alcanza el nivel 2',
    icon: '🌱',
    category: 'level',
    requirement: { type: 'xp', value: 10 },
    reward: { type: 'points', points: 10 },
    rarity: 'common',
    points: 10,
    isHidden: false
  },
  {
    name: 'Aventurero Novato',
    description: 'Alcanza el nivel 5',
    icon: '⚔️',
    category: 'level',
    requirement: { type: 'xp', value: 50 },
    reward: { type: 'points', points: 25 },
    rarity: 'common',
    points: 25,
    isHidden: false
  },
  {
    name: 'Guerrero Experimentado',
    description: 'Alcanza el nivel 10',
    icon: '🛡️',
    category: 'level',
    requirement: { type: 'xp', value: 100 },
    reward: { type: 'points', points: 50 },
    rarity: 'rare',
    points: 50,
    isHidden: false
  },
  {
    name: 'Héroe de Azeroth',
    description: 'Alcanza el nivel 20',
    icon: '👑',
    category: 'level',
    requirement: { type: 'xp', value: 350 },
    reward: { type: 'points', points: 100 },
    rarity: 'epic',
    points: 100,
    isHidden: false
  },
  {
    name: 'Leyenda Viviente',
    description: 'Alcanza el nivel 30',
    icon: '⭐',
    category: 'level',
    requirement: { type: 'xp', value: 750 },
    reward: { type: 'points', points: 200 },
    rarity: 'legendary',
    points: 200,
    isHidden: false
  },

  // Logros de Posts
  {
    name: 'Primera Publicación',
    description: 'Crea tu primer post',
    icon: '📝',
    category: 'posts',
    requirement: { type: 'posts', value: 1 },
    reward: { type: 'points', points: 5 },
    rarity: 'common',
    points: 5,
    isHidden: false
  },
  {
    name: 'Escritor Activo',
    description: 'Crea 10 posts',
    icon: '✍️',
    category: 'posts',
    requirement: { type: 'posts', value: 10 },
    reward: { type: 'points', points: 25 },
    rarity: 'common',
    points: 25,
    isHidden: false
  },
  {
    name: 'Creador de Contenido',
    description: 'Crea 25 posts',
    icon: '📚',
    category: 'posts',
    requirement: { type: 'posts', value: 25 },
    reward: { type: 'points', points: 50 },
    rarity: 'rare',
    points: 50,
    isHidden: false
  },
  {
    name: 'Maestro Narrador',
    description: 'Crea 50 posts',
    icon: '📖',
    category: 'posts',
    requirement: { type: 'posts', value: 50 },
    reward: { type: 'points', points: 100 },
    rarity: 'epic',
    points: 100,
    isHidden: false
  },
  {
    name: 'Cronista de Azeroth',
    description: 'Crea 100 posts',
    icon: '📜',
    category: 'posts',
    requirement: { type: 'posts', value: 100 },
    reward: { type: 'points', points: 250 },
    rarity: 'legendary',
    points: 250,
    isHidden: false
  },

  // Logros de Respuestas
  {
    name: 'Primera Respuesta',
    description: 'Responde a tu primer post',
    icon: '💬',
    category: 'replies',
    requirement: { type: 'replies', value: 1 },
    reward: { type: 'points', points: 5 },
    rarity: 'common',
    points: 5,
    isHidden: false
  },
  {
    name: 'Conversador',
    description: 'Escribe 25 respuestas',
    icon: '🗨️',
    category: 'replies',
    requirement: { type: 'replies', value: 25 },
    reward: { type: 'points', points: 25 },
    rarity: 'common',
    points: 25,
    isHidden: false
  },
  {
    name: 'Participante Activo',
    description: 'Escribe 50 respuestas',
    icon: '💭',
    category: 'replies',
    requirement: { type: 'replies', value: 50 },
    reward: { type: 'points', points: 50 },
    rarity: 'rare',
    points: 50,
    isHidden: false
  },
  {
    name: 'Voz de la Comunidad',
    description: 'Escribe 100 respuestas',
    icon: '📣',
    category: 'replies',
    requirement: { type: 'replies', value: 100 },
    reward: { type: 'points', points: 100 },
    rarity: 'epic',
    points: 100,
    isHidden: false
  },
  {
    name: 'Consejero Sabio',
    description: 'Escribe 250 respuestas',
    icon: '🧙',
    category: 'replies',
    requirement: { type: 'replies', value: 250 },
    reward: { type: 'points', points: 250 },
    rarity: 'legendary',
    points: 250,
    isHidden: false
  },

  // Logros de Referidos
  {
    name: 'Reclutador',
    description: 'Invita a tu primer amigo',
    icon: '🤝',
    category: 'referrals',
    requirement: { type: 'referrals', value: 1 },
    reward: { type: 'points', points: 20 },
    rarity: 'common',
    points: 20,
    isHidden: false
  },
  {
    name: 'Embajador',
    description: 'Invita a 5 amigos',
    icon: '🌟',
    category: 'referrals',
    requirement: { type: 'referrals', value: 5 },
    reward: { type: 'points', points: 100 },
    rarity: 'rare',
    points: 100,
    isHidden: false
  },
  {
    name: 'Líder de Gremio',
    description: 'Invita a 10 amigos',
    icon: '👥',
    category: 'referrals',
    requirement: { type: 'referrals', value: 10 },
    reward: { type: 'points', points: 250 },
    rarity: 'epic',
    points: 250,
    isHidden: false
  },
  {
    name: 'Fundador de Comunidad',
    description: 'Invita a 25 amigos',
    icon: '🏰',
    category: 'referrals',
    requirement: { type: 'referrals', value: 25 },
    reward: { type: 'points', points: 500 },
    rarity: 'legendary',
    points: 500,
    isHidden: false
  },

  // Logros Especiales
  {
    name: 'Bienvenido a Azeroth',
    description: 'Completa tu perfil por primera vez',
    icon: '🎉',
    category: 'special',
    requirement: { type: 'special', value: 1 },
    reward: { type: 'points', points: 10 },
    rarity: 'common',
    points: 10,
    isHidden: false
  },
  {
    name: 'Madrugador',
    description: 'Publica un post antes de las 6 AM',
    icon: '🌅',
    category: 'special',
    requirement: { type: 'special', value: 1 },
    reward: { type: 'points', points: 15 },
    rarity: 'rare',
    points: 15,
    isHidden: true
  },
  {
    name: 'Noctámbulo',
    description: 'Publica un post después de las 12 AM',
    icon: '🌙',
    category: 'special',
    requirement: { type: 'special', value: 1 },
    reward: { type: 'points', points: 15 },
    rarity: 'rare',
    points: 15,
    isHidden: true
  },
  {
    name: 'Racha de Fuego',
    description: 'Publica durante 7 días consecutivos',
    icon: '🔥',
    category: 'special',
    requirement: { type: 'special', value: 7 },
    reward: { type: 'points', points: 50 },
    rarity: 'epic',
    points: 50,
    isHidden: false
  },
  {
    name: 'Veterano',
    description: 'Lleva 30 días en la comunidad',
    icon: '🎖️',
    category: 'special',
    requirement: { type: 'special', value: 30 },
    reward: { type: 'points', points: 100 },
    rarity: 'epic',
    points: 100,
    isHidden: false
  }
];

async function seedAchievements() {
  try {
    // Verificar si ya existen logros
    const existingCount = await Achievement.countDocuments();
    
    if (existingCount > 0) {
      console.log(`ℹ️  Ya existen ${existingCount} logros en la base de datos. Saltando seed.`);
      return { skipped: true, count: existingCount };
    }

    console.log('📦 Creando logros iniciales...');

    // Insertar nuevos logros
    const inserted = await Achievement.insertMany(achievements);
    console.log(`✅ ${inserted.length} logros creados exitosamente`);

    // Mostrar resumen
    console.log('\n📊 Resumen de logros por categoría:');
    const categories = await Achievement.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    categories.forEach(cat => {
      console.log(`   - ${cat._id}: ${cat.count} logros`);
    });

    console.log('\n🏆 Logros por rareza:');
    const rarities = await Achievement.aggregate([
      { $group: { _id: '$rarity', count: { $sum: 1 } } }
    ]);
    rarities.forEach(rar => {
      console.log(`   - ${rar._id}: ${rar.count} logros`);
    });

    return { created: true, count: inserted.length };
  } catch (error) {
    console.error('❌ Error en seed de logros:', error);
    throw error;
  }
}

// Si se ejecuta directamente desde línea de comandos
if (require.main === module) {
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('📦 Conectado a MongoDB');
      
      await seedAchievements();
      
      await mongoose.disconnect();
      console.log('\n✅ Seed completado exitosamente');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  })();
}

// Exportar para uso en el servidor
module.exports = seedAchievements;
