require('dotenv').config();
const mongoose = require('mongoose');
const Badge = require('../models/Badge');

const badges = [
  // MILITARES - Común (50-150 pts)
  {
    name: 'Recluta',
    description: 'Primera insignia militar. Bienvenido al servicio.',
    icon: '🎖️',
    category: 'military',
    rarity: 'common',
    price: 50,
    requiredLevel: 1,
    displayOrder: 1
  },
  {
    name: 'Soldado Raso',
    description: 'Has demostrado disciplina básica.',
    icon: '⚔️',
    category: 'military',
    rarity: 'common',
    price: 75,
    requiredLevel: 3,
    displayOrder: 2
  },
  {
    name: 'Cabo',
    description: 'Primer rango de liderazgo.',
    icon: '🛡️',
    category: 'military',
    rarity: 'common',
    price: 100,
    requiredLevel: 5,
    displayOrder: 3
  },
  {
    name: 'Sargento',
    description: 'Líder de escuadra experimentado.',
    icon: '⚜️',
    category: 'military',
    rarity: 'common',
    price: 150,
    requiredLevel: 7,
    displayOrder: 4
  },
  
  // MILITARES - Raro (200-400 pts)
  {
    name: 'Teniente',
    description: 'Oficial de bajo rango con autoridad.',
    icon: '🎗️',
    category: 'military',
    rarity: 'rare',
    price: 200,
    requiredLevel: 10,
    displayOrder: 5
  },
  {
    name: 'Capitán',
    description: 'Comandante de compañía.',
    icon: '🏅',
    category: 'military',
    rarity: 'rare',
    price: 300,
    requiredLevel: 15,
    displayOrder: 6
  },
  {
    name: 'Mayor',
    description: 'Oficial superior de batallón.',
    icon: '🎖️',
    category: 'military',
    rarity: 'rare',
    price: 400,
    requiredLevel: 20,
    displayOrder: 7
  },
  
  // MILITARES - Épico (500-800 pts)
  {
    name: 'Coronel',
    description: 'Comandante de regimiento.',
    icon: '🥇',
    category: 'military',
    rarity: 'epic',
    price: 500,
    requiredLevel: 25,
    displayOrder: 8
  },
  {
    name: 'General',
    description: 'Alto mando militar.',
    icon: '⭐',
    category: 'military',
    rarity: 'epic',
    price: 700,
    requiredLevel: 30,
    displayOrder: 9
  },
  {
    name: 'Mariscal de Campo',
    description: 'Máximo rango militar alcanzable.',
    icon: '👑',
    category: 'military',
    rarity: 'legendary',
    price: 1000,
    requiredLevel: 40,
    displayOrder: 10
  },
  
  // EXPLORADORES - Común (50-150 pts)
  {
    name: 'Explorador Novato',
    description: 'Primera insignia de exploración.',
    icon: '🏕️',
    category: 'explorer',
    rarity: 'common',
    price: 50,
    requiredLevel: 1,
    displayOrder: 11
  },
  {
    name: 'Rastreador',
    description: 'Sabes seguir el rastro.',
    icon: '🧭',
    category: 'explorer',
    rarity: 'common',
    price: 75,
    requiredLevel: 3,
    displayOrder: 12
  },
  {
    name: 'Campista',
    description: 'Experto en supervivencia básica.',
    icon: '⛺',
    category: 'explorer',
    rarity: 'common',
    price: 100,
    requiredLevel: 5,
    displayOrder: 13
  },
  {
    name: 'Guía',
    description: 'Conoces los caminos.',
    icon: '🗺️',
    category: 'explorer',
    rarity: 'common',
    price: 150,
    requiredLevel: 7,
    displayOrder: 14
  },
  
  // EXPLORADORES - Raro (200-400 pts)
  {
    name: 'Montañista',
    description: 'Has conquistado las alturas.',
    icon: '🏔️',
    category: 'explorer',
    rarity: 'rare',
    price: 200,
    requiredLevel: 10,
    displayOrder: 15
  },
  {
    name: 'Navegante',
    description: 'Maestro de los mares.',
    icon: '⚓',
    category: 'explorer',
    rarity: 'rare',
    price: 300,
    requiredLevel: 15,
    displayOrder: 16
  },
  {
    name: 'Cartógrafo',
    description: 'Has mapeado tierras desconocidas.',
    icon: '🗺️',
    category: 'explorer',
    rarity: 'rare',
    price: 400,
    requiredLevel: 20,
    displayOrder: 17
  },
  
  // EXPLORADORES - Épico (500-800 pts)
  {
    name: 'Aventurero Legendario',
    description: 'Tus hazañas son legendarias.',
    icon: '🌟',
    category: 'explorer',
    rarity: 'epic',
    price: 500,
    requiredLevel: 25,
    displayOrder: 18
  },
  {
    name: 'Descubridor de Mundos',
    description: 'Has explorado lo inexplorado.',
    icon: '🌍',
    category: 'explorer',
    rarity: 'epic',
    price: 700,
    requiredLevel: 30,
    displayOrder: 19
  },
  {
    name: 'Maestro Explorador',
    description: 'El explorador definitivo.',
    icon: '🏆',
    category: 'explorer',
    rarity: 'legendary',
    price: 1000,
    requiredLevel: 40,
    displayOrder: 20
  },
  
  // ESPECIALES - Variados
  {
    name: 'Corazón Valiente',
    description: 'Nunca te rindes.',
    icon: '❤️',
    category: 'special',
    rarity: 'rare',
    price: 250,
    requiredLevel: 10,
    displayOrder: 21
  },
  {
    name: 'Mente Brillante',
    description: 'Tu intelecto destaca.',
    icon: '🧠',
    category: 'special',
    rarity: 'rare',
    price: 250,
    requiredLevel: 10,
    displayOrder: 22
  },
  {
    name: 'Espíritu Indomable',
    description: 'Tu voluntad es inquebrantable.',
    icon: '🔥',
    category: 'special',
    rarity: 'epic',
    price: 500,
    requiredLevel: 20,
    displayOrder: 23
  },
  {
    name: 'Guardián de la Comunidad',
    description: 'Proteges a los demás.',
    icon: '🛡️',
    category: 'special',
    rarity: 'epic',
    price: 600,
    requiredLevel: 25,
    displayOrder: 24
  },
  {
    name: 'Héroe del Pueblo',
    description: 'Eres un verdadero héroe.',
    icon: '🦸',
    category: 'special',
    rarity: 'legendary',
    price: 900,
    requiredLevel: 35,
    displayOrder: 25
  },
  
  // LEGENDARIOS - Muy caros y exclusivos
  {
    name: 'Leyenda Viviente',
    description: 'Tu nombre será recordado por siempre.',
    icon: '💫',
    category: 'legendary',
    rarity: 'legendary',
    price: 1500,
    requiredLevel: 45,
    displayOrder: 26
  },
  {
    name: 'Campeón Supremo',
    description: 'Has alcanzado la cima absoluta.',
    icon: '👑',
    category: 'legendary',
    rarity: 'legendary',
    price: 2000,
    requiredLevel: 50,
    displayOrder: 27
  },
  {
    name: 'Guardián del Reino',
    description: 'Protector supremo de Azeroth.',
    icon: '🏰',
    category: 'legendary',
    rarity: 'legendary',
    price: 1800,
    requiredLevel: 48,
    displayOrder: 28
  },
  {
    name: 'Maestro de Maestros',
    description: 'Has dominado todas las artes.',
    icon: '🎓',
    category: 'legendary',
    rarity: 'legendary',
    price: 2500,
    requiredLevel: 50,
    displayOrder: 29
  },
  {
    name: 'Elegido de los Dioses',
    description: 'Los dioses te han bendecido.',
    icon: '✨',
    category: 'legendary',
    rarity: 'legendary',
    price: 3000,
    requiredLevel: 50,
    displayOrder: 30
  }
];

const seedBadges = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB para seed de badges');
    
    for (const badgeData of badges) {
      await Badge.findOneAndUpdate(
        { name: badgeData.name },
        badgeData,
        { upsert: true, new: true }
      );
      console.log(`✅ Badge creado/actualizado: ${badgeData.name}`);
    }
    
    console.log(`🎖️ Seed completado: ${badges.length} badges procesados`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error en seed de badges:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedBadges();
}

module.exports = seedBadges;
