const RewardItem = require('../models/RewardItem');

const defaultRewards = [
  // EMOJIS
  {
    name: '🔥 Fuego',
    description: 'Emoji de fuego para mostrar tu pasión',
    type: 'emoji',
    cost: 50,
    content: '🔥',
    rarity: 'common'
  },
  {
    name: '⚔️ Espadas Cruzadas',
    description: 'Muestra tu espíritu guerrero',
    type: 'emoji',
    cost: 75,
    content: '⚔️',
    rarity: 'common'
  },
  {
    name: '👑 Corona',
    description: 'Demuestra tu realeza',
    type: 'emoji',
    cost: 100,
    content: '👑',
    rarity: 'rare'
  },
  {
    name: '💎 Diamante',
    description: 'Brilla como un diamante',
    type: 'emoji',
    cost: 150,
    content: '💎',
    rarity: 'rare'
  },
  {
    name: '🌟 Estrella Brillante',
    description: 'Eres una estrella',
    type: 'emoji',
    cost: 200,
    content: '🌟',
    rarity: 'epic'
  },
  {
    name: '🐉 Dragón',
    description: 'El poder del dragón',
    type: 'emoji',
    cost: 300,
    content: '🐉',
    rarity: 'epic'
  },
  {
    name: '🏆 Trofeo',
    description: 'Eres un campeón',
    type: 'emoji',
    cost: 500,
    content: '🏆',
    rarity: 'legendary'
  },

  // TÍTULOS
  {
    name: 'Novato',
    description: 'Apenas comienzas tu aventura',
    type: 'title',
    cost: 0,
    content: 'Novato',
    rarity: 'common'
  },
  {
    name: 'Aventurero',
    description: 'Has explorado muchos caminos',
    type: 'title',
    cost: 100,
    content: 'Aventurero',
    rarity: 'common'
  },
  {
    name: 'Cazador de Tesoros',
    description: 'Siempre buscando recompensas',
    type: 'title',
    cost: 150,
    content: 'Cazador de Tesoros',
    rarity: 'rare'
  },
  {
    name: 'Héroe de la Comunidad',
    description: 'Reconocido por todos',
    type: 'title',
    cost: 250,
    content: 'Héroe de la Comunidad',
    rarity: 'rare'
  },
  {
    name: 'Leyenda Viviente',
    description: 'Tu nombre será recordado',
    type: 'title',
    cost: 400,
    content: 'Leyenda Viviente',
    rarity: 'epic'
  },
  {
    name: 'Maestro del Foro',
    description: 'Dominas todas las artes del foro',
    type: 'title',
    cost: 600,
    content: 'Maestro del Foro',
    rarity: 'epic'
  },
  {
    name: 'Dios de Azeroth',
    description: 'Has alcanzado la divinidad',
    type: 'title',
    cost: 1000,
    content: 'Dios de Azeroth',
    rarity: 'legendary'
  },

  // TEMAS
  {
    name: 'Tema Oscuro',
    description: 'Perfil con estilo oscuro elegante',
    type: 'theme',
    cost: 200,
    content: JSON.stringify({
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      textColor: '#e0e0e0',
      accentColor: '#8E2DE2'
    }),
    rarity: 'common'
  },
  {
    name: 'Tema Fuego',
    description: 'Perfil con colores ardientes',
    type: 'theme',
    cost: 300,
    content: JSON.stringify({
      background: 'linear-gradient(135deg, #ff4e50 0%, #f9d423 100%)',
      textColor: '#ffffff',
      accentColor: '#ff6b6b'
    }),
    rarity: 'rare'
  },
  {
    name: 'Tema Océano',
    description: 'Perfil con colores del mar',
    type: 'theme',
    cost: 300,
    content: JSON.stringify({
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      textColor: '#ffffff',
      accentColor: '#4facfe'
    }),
    rarity: 'rare'
  },
  {
    name: 'Tema Naturaleza',
    description: 'Perfil con colores de la naturaleza',
    type: 'theme',
    cost: 400,
    content: JSON.stringify({
      background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      textColor: '#ffffff',
      accentColor: '#06d6a0'
    }),
    rarity: 'epic'
  },
  {
    name: 'Tema Arcoíris',
    description: 'Perfil con todos los colores',
    type: 'theme',
    cost: 800,
    content: JSON.stringify({
      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 25%, #feca57 50%, #48dbfb 75%, #ff9ff3 100%)',
      textColor: '#ffffff',
      accentColor: '#ee5a6f'
    }),
    rarity: 'legendary'
  },

  // MARCOS
  {
    name: 'Marco Básico',
    description: 'Un marco simple para tu foto',
    type: 'frame',
    cost: 100,
    content: JSON.stringify({
      border: '3px solid #8E2DE2',
      borderRadius: '50%',
      boxShadow: '0 0 10px rgba(142, 45, 226, 0.5)'
    }),
    rarity: 'common'
  },
  {
    name: 'Marco de Oro',
    description: 'Marco dorado brillante',
    type: 'frame',
    cost: 250,
    content: JSON.stringify({
      border: '4px solid #FFD700',
      borderRadius: '50%',
      boxShadow: '0 0 15px rgba(255, 215, 0, 0.7)'
    }),
    rarity: 'rare'
  },
  {
    name: 'Marco de Diamante',
    description: 'Marco con brillo de diamante',
    type: 'frame',
    cost: 400,
    content: JSON.stringify({
      border: '5px solid #b9f2ff',
      borderRadius: '50%',
      boxShadow: '0 0 20px rgba(185, 242, 255, 0.8), 0 0 30px rgba(185, 242, 255, 0.5)'
    }),
    rarity: 'epic'
  },
  {
    name: 'Marco Arcoíris',
    description: 'Marco con efecto arcoíris animado',
    type: 'frame',
    cost: 600,
    content: JSON.stringify({
      border: '6px solid transparent',
      borderRadius: '50%',
      backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #f093fb 0%, #f5576c 25%, #feca57 50%, #48dbfb 75%, #ff9ff3 100%)',
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
      boxShadow: '0 0 25px rgba(255, 105, 180, 0.8)'
    }),
    rarity: 'epic'
  },
  {
    name: 'Marco Legendario',
    description: 'El marco más exclusivo y poderoso',
    type: 'frame',
    cost: 1000,
    content: JSON.stringify({
      border: '8px solid transparent',
      borderRadius: '50%',
      backgroundImage: 'linear-gradient(white, white), linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000)',
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
      animation: 'rotate 3s linear infinite',
      boxShadow: '0 0 30px rgba(255, 0, 255, 1), 0 0 50px rgba(0, 255, 255, 0.8)'
    }),
    rarity: 'legendary'
  }
];

const seedRewards = async () => {
  try {
    const existingCount = await RewardItem.countDocuments();
    
    if (existingCount === 0) {
      await RewardItem.insertMany(defaultRewards);
      console.log(`✅ ${defaultRewards.length} recompensas creadas exitosamente`);
    } else {
      console.log(`ℹ️ Ya existen ${existingCount} recompensas en la base de datos`);
    }
  } catch (error) {
    console.error('❌ Error al crear recompensas:', error);
  }
};

module.exports = seedRewards;
