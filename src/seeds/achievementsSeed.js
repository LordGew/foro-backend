const Achievement = require('../models/Achievement');
const RewardItem = require('../models/RewardItem');

/**
 * Seed de logros iniciales
 */
async function seedAchievements() {
  try {
    console.log('🏆 Iniciando seed de logros...');

    // Verificar si ya existen logros
    const existingCount = await Achievement.countDocuments();
    if (existingCount > 0) {
      console.log(`✅ Ya existen ${existingCount} logros. Saltando seed.`);
      return;
    }

    // Buscar recompensas existentes para vincular
    const rewards = await RewardItem.find();

    const achievements = [
      // Logros de Nivel/XP
      {
        name: 'Primer Paso',
        description: 'Alcanza el nivel 5',
        icon: '🎯',
        category: 'level',
        requirement: { type: 'xp', value: 250 },
        rarity: 'common',
        points: 10,
        isHidden: false
      },
      {
        name: 'Aventurero',
        description: 'Alcanza el nivel 10',
        icon: '⚔️',
        category: 'level',
        requirement: { type: 'xp', value: 1000 },
        rarity: 'common',
        points: 25,
        isHidden: false
      },
      {
        name: 'Héroe Emergente',
        description: 'Alcanza el nivel 20',
        icon: '🛡️',
        category: 'level',
        requirement: { type: 'xp', value: 4000 },
        rarity: 'rare',
        points: 50,
        isHidden: false
      },
      {
        name: 'Campeón',
        description: 'Alcanza el nivel 30',
        icon: '👑',
        category: 'level',
        requirement: { type: 'xp', value: 9000 },
        rarity: 'epic',
        points: 100,
        isHidden: false
      },
      {
        name: 'Leyenda Viviente',
        description: 'Alcanza el nivel 50',
        icon: '⭐',
        category: 'level',
        requirement: { type: 'xp', value: 25000 },
        rarity: 'legendary',
        points: 250,
        isHidden: false
      },

      // Logros de Posts
      {
        name: 'Primera Publicación',
        description: 'Crea tu primer post',
        icon: '📝',
        category: 'posts',
        requirement: { type: 'posts', value: 1 },
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
        rarity: 'common',
        points: 20,
        isHidden: false
      },
      {
        name: 'Creador de Contenido',
        description: 'Crea 50 posts',
        icon: '📚',
        category: 'posts',
        requirement: { type: 'posts', value: 50 },
        rarity: 'rare',
        points: 75,
        isHidden: false
      },
      {
        name: 'Autor Prolífico',
        description: 'Crea 100 posts',
        icon: '🏆',
        category: 'posts',
        requirement: { type: 'posts', value: 100 },
        rarity: 'epic',
        points: 150,
        isHidden: false
      },
      {
        name: 'Maestro del Contenido',
        description: 'Crea 250 posts',
        icon: '🌟',
        category: 'posts',
        requirement: { type: 'posts', value: 250 },
        rarity: 'legendary',
        points: 300,
        isHidden: false
      },

      // Logros de Respuestas
      {
        name: 'Primera Respuesta',
        description: 'Responde a un post por primera vez',
        icon: '💬',
        category: 'replies',
        requirement: { type: 'replies', value: 1 },
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
        rarity: 'common',
        points: 15,
        isHidden: false
      },
      {
        name: 'Participante Activo',
        description: 'Escribe 100 respuestas',
        icon: '💭',
        category: 'replies',
        requirement: { type: 'replies', value: 100 },
        rarity: 'rare',
        points: 50,
        isHidden: false
      },
      {
        name: 'Experto en Debates',
        description: 'Escribe 500 respuestas',
        icon: '🎤',
        category: 'replies',
        requirement: { type: 'replies', value: 500 },
        rarity: 'epic',
        points: 125,
        isHidden: false
      },
      {
        name: 'Voz de la Comunidad',
        description: 'Escribe 1000 respuestas',
        icon: '📢',
        category: 'replies',
        requirement: { type: 'replies', value: 1000 },
        rarity: 'legendary',
        points: 250,
        isHidden: false
      },

      // Logros de Referidos
      {
        name: 'Primer Referido',
        description: 'Invita a tu primer usuario',
        icon: '👥',
        category: 'referrals',
        requirement: { type: 'referrals', value: 1 },
        rarity: 'common',
        points: 10,
        reward: { type: 'points', points: 50 },
        isHidden: false
      },
      {
        name: 'Reclutador',
        description: 'Invita a 5 usuarios',
        icon: '🤝',
        category: 'referrals',
        requirement: { type: 'referrals', value: 5 },
        rarity: 'rare',
        points: 50,
        reward: { type: 'points', points: 100 },
        isHidden: false
      },
      {
        name: 'Embajador',
        description: 'Invita a 10 usuarios',
        icon: '🌐',
        category: 'referrals',
        requirement: { type: 'referrals', value: 10 },
        rarity: 'epic',
        points: 100,
        reward: { type: 'points', points: 250 },
        isHidden: false
      },
      {
        name: 'Líder Comunitario',
        description: 'Invita a 25 usuarios',
        icon: '🏅',
        category: 'referrals',
        requirement: { type: 'referrals', value: 25 },
        rarity: 'legendary',
        points: 250,
        reward: { type: 'points', points: 500 },
        isHidden: false
      },

      // Logros Especiales
      {
        name: 'Bienvenido',
        description: 'Completa tu perfil',
        icon: '👋',
        category: 'special',
        requirement: { type: 'special', value: 1 },
        rarity: 'common',
        points: 5,
        isHidden: false
      },
      {
        name: 'Coleccionista',
        description: 'Adquiere 5 recompensas',
        icon: '🎁',
        category: 'special',
        requirement: { type: 'special', value: 5 },
        rarity: 'rare',
        points: 30,
        isHidden: false
      },
      {
        name: 'Veterano',
        description: 'Lleva 30 días en la comunidad',
        icon: '🎖️',
        category: 'special',
        requirement: { type: 'special', value: 30 },
        rarity: 'epic',
        points: 75,
        isHidden: false
      },
      {
        name: 'Madrugador',
        description: 'Publica entre las 5 AM y 7 AM',
        icon: '🌅',
        category: 'special',
        requirement: { type: 'special', value: 1 },
        rarity: 'rare',
        points: 25,
        isHidden: true
      },
      {
        name: 'Noctámbulo',
        description: 'Publica entre las 2 AM y 4 AM',
        icon: '🌙',
        category: 'special',
        requirement: { type: 'special', value: 1 },
        rarity: 'rare',
        points: 25,
        isHidden: true
      },
      {
        name: 'Velocista',
        description: 'Escribe 10 posts en un día',
        icon: '⚡',
        category: 'special',
        requirement: { type: 'special', value: 10 },
        rarity: 'epic',
        points: 50,
        isHidden: false
      },
      {
        name: 'Conversador Incansable',
        description: 'Escribe 50 respuestas en un día',
        icon: '💨',
        category: 'special',
        requirement: { type: 'special', value: 50 },
        rarity: 'epic',
        points: 75,
        isHidden: false
      },
      {
        name: 'Influencer',
        description: 'Recibe 100 likes en total',
        icon: '💫',
        category: 'special',
        requirement: { type: 'special', value: 100 },
        rarity: 'rare',
        points: 40,
        isHidden: false
      },
      {
        name: 'Celebridad',
        description: 'Recibe 500 likes en total',
        icon: '🌟',
        category: 'special',
        requirement: { type: 'special', value: 500 },
        rarity: 'epic',
        points: 100,
        isHidden: false
      },
      {
        name: 'Leyenda',
        description: 'Recibe 1000 likes en total',
        icon: '✨',
        category: 'special',
        requirement: { type: 'special', value: 1000 },
        rarity: 'legendary',
        points: 200,
        isHidden: false
      },
      {
        name: 'Explorador',
        description: 'Visita todas las categorías del foro',
        icon: '🗺️',
        category: 'special',
        requirement: { type: 'special', value: 1 },
        rarity: 'rare',
        points: 30,
        isHidden: false
      },
      {
        name: 'Multijugador',
        description: 'Participa en 5 juegos diferentes',
        icon: '🎮',
        category: 'special',
        requirement: { type: 'special', value: 5 },
        rarity: 'rare',
        points: 35,
        isHidden: false
      },
      {
        name: 'Fanático de WoW',
        description: 'Crea 50 posts sobre World of Warcraft',
        icon: '⚔️',
        category: 'special',
        requirement: { type: 'special', value: 50 },
        rarity: 'epic',
        points: 80,
        isHidden: false
      },
      {
        name: 'Guardián del Foro',
        description: 'Reporta 10 contenidos inapropiados',
        icon: '🛡️',
        category: 'special',
        requirement: { type: 'special', value: 10 },
        rarity: 'rare',
        points: 40,
        isHidden: false
      },
      {
        name: 'Benefactor',
        description: 'Activa VIP por primera vez',
        icon: '💎',
        category: 'special',
        requirement: { type: 'special', value: 1 },
        rarity: 'epic',
        points: 100,
        reward: { type: 'points', points: 200 },
        isHidden: false
      },
      {
        name: 'Coleccionista Supremo',
        description: 'Adquiere 20 recompensas diferentes',
        icon: '🏆',
        category: 'special',
        requirement: { type: 'special', value: 20 },
        rarity: 'legendary',
        points: 150,
        isHidden: false
      },
      {
        name: 'Maestro de Estilos',
        description: 'Equipa 10 temas diferentes',
        icon: '🎨',
        category: 'special',
        requirement: { type: 'special', value: 10 },
        rarity: 'epic',
        points: 60,
        isHidden: true
      },
      {
        name: 'Número de la Suerte',
        description: '???',
        icon: '🍀',
        category: 'special',
        requirement: { type: 'special', value: 777 },
        rarity: 'legendary',
        points: 777,
        reward: { type: 'points', points: 777 },
        isHidden: true
      },
      {
        name: 'El Elegido',
        description: '???',
        icon: '👑',
        category: 'special',
        requirement: { type: 'special', value: 1 },
        rarity: 'legendary',
        points: 500,
        isHidden: true
      },
      {
        name: 'Viajero del Tiempo',
        description: '???',
        icon: '⏰',
        category: 'special',
        requirement: { type: 'special', value: 1 },
        rarity: 'legendary',
        points: 250,
        isHidden: true
      }
    ];

    // Insertar logros
    const createdAchievements = await Achievement.insertMany(achievements);
    console.log(`✅ ${createdAchievements.length} logros creados exitosamente`);

    return createdAchievements;
  } catch (error) {
    console.error('❌ Error en seed de logros:', error);
    throw error;
  }
}

module.exports = seedAchievements;
