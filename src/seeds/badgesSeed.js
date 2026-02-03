const Badge = require('../models/Badge');

// URLs de Twemoji (Twitter Emoji) - CDN público y libre
const twemojiBase = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/';

const badges = [
  // COMMON - Nivel Inicial (10 badges)
  {
    name: 'Novato',
    description: 'Primera insignia para nuevos miembros',
    icon: '🌟',
    iconUrl: `${twemojiBase}1f31f.svg`,
    category: 'military',
    rarity: 'common',
    price: 100,
    requiredLevel: 1,
    displayOrder: 1,
    available: true
  },
  {
    name: 'Explorador',
    description: 'Para quienes exploran la comunidad',
    icon: '🔍',
    iconUrl: `${twemojiBase}1f50d.svg`,
    category: 'military',
    rarity: 'common',
    price: 150,
    requiredLevel: 2,
    displayOrder: 2,
    available: true
  },
  {
    name: 'Conversador',
    description: 'Participa activamente en discusiones',
    icon: '💬',
    iconUrl: `${twemojiBase}1f4ac.svg`,
    category: 'explorer',
    rarity: 'common',
    price: 200,
    requiredLevel: 3,
    displayOrder: 3,
    available: true
  },
  {
    name: 'Lector Ávido',
    description: 'Lee muchos posts de la comunidad',
    icon: '📚',
    iconUrl: `${twemojiBase}1f4da.svg`,
    category: 'military',
    rarity: 'common',
    price: 180,
    requiredLevel: 2,
    displayOrder: 4,
    available: true
  },
  {
    name: 'Amigable',
    description: 'Hace amigos en la comunidad',
    icon: '😊',
    iconUrl: `${twemojiBase}1f60a.svg`,
    category: 'explorer',
    rarity: 'common',
    price: 220,
    requiredLevel: 3,
    displayOrder: 5,
    available: true
  },
  {
    name: 'Madrugador',
    description: 'Activo en las mañanas',
    icon: '🌅',
    iconUrl: `${twemojiBase}1f305.svg`,
    category: 'special',
    rarity: 'common',
    price: 250,
    requiredLevel: 4,
    displayOrder: 6,
    available: true
  },
  {
    name: 'Noctámbulo',
    description: 'Activo en las noches',
    icon: '🌙',
    iconUrl: `${twemojiBase}1f319.svg`,
    category: 'special',
    rarity: 'common',
    price: 250,
    requiredLevel: 4,
    displayOrder: 7,
    available: true
  },
  {
    name: 'Creativo',
    description: 'Crea contenido original',
    icon: '🎨',
    iconUrl: `${twemojiBase}1f3a8.svg`,
    category: 'military',
    rarity: 'common',
    price: 300,
    requiredLevel: 5,
    displayOrder: 8,
    available: true
  },
  {
    name: 'Colaborador',
    description: 'Ayuda a otros miembros',
    icon: '🤝',
    iconUrl: `${twemojiBase}1f91d.svg`,
    category: 'explorer',
    rarity: 'common',
    price: 280,
    requiredLevel: 4,
    displayOrder: 9,
    available: true
  },
  {
    name: 'Entusiasta',
    description: 'Muestra gran entusiasmo',
    icon: '🎉',
    iconUrl: `${twemojiBase}1f389.svg`,
    category: 'special',
    rarity: 'common',
    price: 320,
    requiredLevel: 5,
    displayOrder: 10,
    available: true
  },

  // UNCOMMON - Nivel Intermedio (10 badges)
  {
    name: 'Veterano',
    description: 'Miembro con experiencia',
    icon: '🎖️',
    iconUrl: `${twemojiBase}1f3c6.svg`,
    category: 'military',
    rarity: 'uncommon',
    price: 500,
    requiredLevel: 10,
    displayOrder: 11,
    available: true
  },
  {
    name: 'Sabio',
    description: 'Comparte conocimiento valioso',
    icon: '🧙',
    iconUrl: `${twemojiBase}1f9d9.svg`,
    category: 'military',
    rarity: 'uncommon',
    price: 600,
    requiredLevel: 12,
    displayOrder: 12,
    available: true
  },
  {
    name: 'Influencer',
    description: 'Tiene muchos seguidores',
    icon: '📱',
    iconUrl: `${twemojiBase}1f4f1.svg`,
    category: 'explorer',
    rarity: 'uncommon',
    price: 700,
    requiredLevel: 15,
    displayOrder: 13,
    available: true
  },
  {
    name: 'Cazador de Bugs',
    description: 'Reporta errores importantes',
    icon: '🐛',
    iconUrl: `${twemojiBase}1f41b.svg`,
    category: 'special',
    rarity: 'uncommon',
    price: 550,
    requiredLevel: 10,
    displayOrder: 14,
    available: true
  },
  {
    name: 'Estratega',
    description: 'Experto en estrategias',
    icon: '♟️',
    iconUrl: `${twemojiBase}265f.svg`,
    category: 'military',
    rarity: 'uncommon',
    price: 650,
    requiredLevel: 13,
    displayOrder: 15,
    available: true
  },
  {
    name: 'Guardián',
    description: 'Protege la comunidad',
    icon: '🛡️',
    iconUrl: `${twemojiBase}1f6e1.svg`,
    category: 'special',
    rarity: 'uncommon',
    price: 800,
    requiredLevel: 15,
    displayOrder: 16,
    available: true
  },
  {
    name: 'Mentor',
    description: 'Guía a nuevos miembros',
    icon: '👨‍🏫',
    iconUrl: `${twemojiBase}1f468-200d-1f3eb.svg`,
    category: 'explorer',
    rarity: 'uncommon',
    price: 750,
    requiredLevel: 14,
    displayOrder: 17,
    available: true
  },
  {
    name: 'Campeón',
    description: 'Gana competencias',
    icon: '🏆',
    iconUrl: `${twemojiBase}1f3c6.svg`,
    category: 'military',
    rarity: 'uncommon',
    price: 900,
    requiredLevel: 16,
    displayOrder: 18,
    available: true
  },
  {
    name: 'Artista',
    description: 'Crea arte excepcional',
    icon: '🖼️',
    iconUrl: `${twemojiBase}1f5bc.svg`,
    category: 'special',
    rarity: 'uncommon',
    price: 700,
    requiredLevel: 12,
    displayOrder: 19,
    available: true
  },
  {
    name: 'Líder',
    description: 'Lidera grupos y eventos',
    icon: '👑',
    iconUrl: `${twemojiBase}1f451.svg`,
    category: 'explorer',
    rarity: 'uncommon',
    price: 850,
    requiredLevel: 15,
    displayOrder: 20,
    available: true
  },

  // RARE - Nivel Avanzado (7 badges)
  {
    name: 'Leyenda',
    description: 'Miembro legendario',
    icon: '⭐',
    iconUrl: `${twemojiBase}2b50.svg`,
    category: 'military',
    rarity: 'rare',
    price: 1500,
    requiredLevel: 25,
    displayOrder: 21,
    available: true
  },
  {
    name: 'Maestro',
    description: 'Domina múltiples áreas',
    icon: '🎓',
    iconUrl: `${twemojiBase}1f393.svg`,
    category: 'military',
    rarity: 'rare',
    price: 1800,
    requiredLevel: 28,
    displayOrder: 22,
    available: true
  },
  {
    name: 'Héroe',
    description: 'Realiza actos heroicos',
    icon: '🦸',
    iconUrl: `${twemojiBase}1f9b8.svg`,
    category: 'special',
    rarity: 'rare',
    price: 2000,
    requiredLevel: 30,
    displayOrder: 23,
    available: true
  },
  {
    name: 'Dragón',
    description: 'Poder y sabiduría',
    icon: '🐉',
    iconUrl: `${twemojiBase}1f409.svg`,
    category: 'special',
    rarity: 'rare',
    price: 2200,
    requiredLevel: 32,
    displayOrder: 24,
    available: true
  },
  {
    name: 'Fénix',
    description: 'Renace de las cenizas',
    icon: '🔥',
    iconUrl: `${twemojiBase}1f525.svg`,
    category: 'special',
    rarity: 'rare',
    price: 1900,
    requiredLevel: 27,
    displayOrder: 25,
    available: true
  },
  {
    name: 'Unicornio',
    description: 'Único y especial',
    icon: '🦄',
    iconUrl: `${twemojiBase}1f984.svg`,
    category: 'special',
    rarity: 'rare',
    price: 2100,
    requiredLevel: 29,
    displayOrder: 26,
    available: true
  },
  {
    name: 'Titán',
    description: 'Fuerza imparable',
    icon: '⚡',
    iconUrl: `${twemojiBase}26a1.svg`,
    category: 'military',
    rarity: 'rare',
    price: 2500,
    requiredLevel: 35,
    displayOrder: 27,
    available: true
  },

  // EPIC - Nivel Élite (5 badges)
  {
    name: 'Emperador',
    description: 'Gobierna con sabiduría',
    icon: '👑',
    iconUrl: `${twemojiBase}1f451.svg`,
    category: 'military',
    rarity: 'epic',
    price: 4000,
    requiredLevel: 45,
    displayOrder: 28,
    available: true
  },
  {
    name: 'Guardián Celestial',
    description: 'Protector divino',
    icon: '✨',
    iconUrl: `${twemojiBase}2728.svg`,
    category: 'special',
    rarity: 'epic',
    price: 4500,
    requiredLevel: 48,
    displayOrder: 29,
    available: true
  },
  {
    name: 'Dios del Olimpo',
    description: 'Poder supremo',
    icon: '⚡',
    iconUrl: `${twemojiBase}26a1.svg`,
    category: 'military',
    rarity: 'epic',
    price: 5000,
    requiredLevel: 50,
    displayOrder: 30,
    available: true
  },
  {
    name: 'Arcángel',
    description: 'Mensajero celestial',
    icon: '👼',
    iconUrl: `${twemojiBase}1f47c.svg`,
    category: 'special',
    rarity: 'epic',
    price: 4200,
    requiredLevel: 46,
    displayOrder: 31,
    available: true
  },
  {
    name: 'Inmortal',
    description: 'Trasciende el tiempo',
    icon: '♾️',
    iconUrl: `${twemojiBase}267e.svg`,
    category: 'military',
    rarity: 'epic',
    price: 5500,
    requiredLevel: 55,
    displayOrder: 32,
    available: true
  },

  // LEGENDARY - Nivel Máximo (3 badges)
  {
    name: 'Creador',
    description: 'Fundador de la comunidad',
    icon: '🌌',
    iconUrl: `${twemojiBase}1f30c.svg`,
    category: 'special',
    rarity: 'legendary',
    price: 10000,
    requiredLevel: 75,
    displayOrder: 33,
    available: true
  },
  {
    name: 'Omnipotente',
    description: 'Poder absoluto',
    icon: '💫',
    iconUrl: `${twemojiBase}1f4ab.svg`,
    category: 'military',
    rarity: 'legendary',
    price: 12000,
    requiredLevel: 80,
    displayOrder: 34,
    available: true
  },
  {
    name: 'Eterno',
    description: 'Existencia infinita',
    icon: '🔮',
    iconUrl: `${twemojiBase}1f52e.svg`,
    category: 'special',
    rarity: 'legendary',
    price: 15000,
    requiredLevel: 100,
    displayOrder: 35,
    available: true
  }
];

async function seedBadges() {
  try {
    console.log('🏅 Iniciando seed de badges...');
    
    // Eliminar badges existentes
    await Badge.deleteMany({});
    console.log('✅ Badges antiguos eliminados');
    
    // Insertar nuevos badges
    const createdBadges = await Badge.insertMany(badges);
    console.log(`✅ ${createdBadges.length} badges creados exitosamente`);
    
    // Mostrar resumen por rareza
    const summary = {
      common: createdBadges.filter(b => b.rarity === 'common').length,
      uncommon: createdBadges.filter(b => b.rarity === 'uncommon').length,
      rare: createdBadges.filter(b => b.rarity === 'rare').length,
      epic: createdBadges.filter(b => b.rarity === 'epic').length,
      legendary: createdBadges.filter(b => b.rarity === 'legendary').length
    };
    
    console.log('📊 Resumen por rareza:');
    console.log(`   Common: ${summary.common}`);
    console.log(`   Uncommon: ${summary.uncommon}`);
    console.log(`   Rare: ${summary.rare}`);
    console.log(`   Epic: ${summary.epic}`);
    console.log(`   Legendary: ${summary.legendary}`);
    
    return createdBadges;
  } catch (error) {
    console.error('❌ Error en seed de badges:', error);
    throw error;
  }
}

module.exports = seedBadges;
