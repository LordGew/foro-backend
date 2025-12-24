const Game = require('../models/Game');
const Category = require('../models/Category');

const defaultGames = [
  {
    name: 'World of Warcraft',
    slug: 'world-of-warcraft',
    description: 'El MMORPG más popular del mundo. Únete a millones de jugadores en Azeroth.',
    icon: '⚔️',
    color: '#FFD100',
    order: 0,
    categories: [
      { name: 'Noticias y Comunidad', description: 'Últimas noticias y eventos de la comunidad' },
      { name: 'Discusión General', description: 'Habla sobre cualquier tema relacionado con WoW' },
      { name: 'Guías y Tutoriales', description: 'Aprende a jugar mejor con nuestras guías' },
      { name: 'Servidores Privados', description: 'Discusión sobre servidores privados' },
      { name: 'Descargas y Recursos', description: 'Addons, macros y recursos útiles' },
      { name: 'Soporte Técnico', description: '¿Problemas técnicos? Te ayudamos aquí' },
      { name: 'Desarrollo y Emulación', description: 'Para desarrolladores de servidores' },
      { name: 'Mercado e Intercambios', description: 'Compra, vende e intercambia' }
    ]
  },
  {
    name: 'Call of Duty',
    slug: 'call-of-duty',
    description: 'El shooter más icónico. Discute sobre todas las entregas de la saga.',
    icon: '🎯',
    color: '#00D9FF',
    order: 1,
    categories: [
      { name: 'Noticias y Actualizaciones', description: 'Últimas noticias de CoD' },
      { name: 'Discusión General', description: 'Todo sobre Call of Duty' },
      { name: 'Warzone', description: 'Battle Royale de CoD' },
      { name: 'Multijugador', description: 'Estrategias y tácticas de MP' },
      { name: 'Zombies', description: 'Modo Zombies y Easter Eggs' },
      { name: 'Clanes y Equipos', description: 'Encuentra tu equipo' },
      { name: 'Soporte Técnico', description: 'Ayuda con problemas técnicos' }
    ]
  },
  {
    name: 'Fortnite',
    slug: 'fortnite',
    description: 'El Battle Royale que revolucionó el género. Construye, lucha y gana.',
    icon: '🏗️',
    color: '#9146FF',
    order: 2,
    categories: [
      { name: 'Noticias y Eventos', description: 'Eventos y temporadas de Fortnite' },
      { name: 'Discusión General', description: 'Habla sobre Fortnite' },
      { name: 'Battle Royale', description: 'Estrategias para ganar' },
      { name: 'Creativo', description: 'Comparte tus creaciones' },
      { name: 'Competitivo', description: 'Torneos y competiciones' },
      { name: 'Cosméticos y Tienda', description: 'Skins, bailes y más' },
      { name: 'Soporte Técnico', description: 'Ayuda técnica' }
    ]
  },
  {
    name: 'Juegos de Android',
    slug: 'juegos-android',
    description: 'Los mejores juegos móviles para Android. Descubre, comparte y disfruta.',
    icon: '📱',
    color: '#3DDC84',
    order: 3,
    categories: [
      { name: 'Recomendaciones', description: 'Descubre nuevos juegos' },
      { name: 'Discusión General', description: 'Todo sobre gaming móvil' },
      { name: 'RPG y Aventura', description: 'Juegos de rol y aventuras' },
      { name: 'Estrategia', description: 'Juegos de estrategia' },
      { name: 'Acción y Shooter', description: 'Acción trepidante' },
      { name: 'Casual y Puzzle', description: 'Juegos casuales' },
      { name: 'Guías y Trucos', description: 'Tips y trucos' },
      { name: 'Soporte Técnico', description: 'Ayuda con problemas' }
    ]
  }
];

const seedGames = async () => {
  try {
    const existingGamesCount = await Game.countDocuments();
    
    if (existingGamesCount === 0) {
      console.log('🎮 Creando juegos y categorías iniciales...');
      
      for (const gameData of defaultGames) {
        const { categories, ...gameInfo } = gameData;
        
        // Crear el juego
        const game = await Game.create(gameInfo);
        console.log(`✅ Juego creado: ${game.name}`);
        
        // Crear las categorías para este juego
        for (let i = 0; i < categories.length; i++) {
          const categoryData = categories[i];
          await Category.create({
            name: categoryData.name,
            description: categoryData.description,
            game: game._id,
            order: i
          });
        }
        console.log(`✅ ${categories.length} categorías creadas para ${game.name}`);
      }
      
      console.log(`✅ ${defaultGames.length} juegos creados exitosamente con sus categorías`);
    } else {
      console.log(`ℹ️ Ya existen ${existingGamesCount} juegos en la base de datos`);
    }
  } catch (error) {
    console.error('❌ Error al crear juegos:', error);
    throw error;
  }
};

module.exports = seedGames;
