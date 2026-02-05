/**
 * VIP Rewards Data
 * Tier structure:
 *   Tier 1 (1 mes)   → requiredMonths: 1
 *   Tier 2 (3 meses)  → requiredMonths: 3
 *   Tier 3 (6 meses)  → requiredMonths: 6
 *   Tier 4 (12 meses) → requiredMonths: 12
 *   Tier 5 (vitalicio) → requiredMonths: 0 (lifetime)
 */

const vipThemes = [
  {
    name: 'Trono Dorado',
    description: 'Un tema majestuoso con tonos dorados y detalles reales. Digno de la realeza VIP.',
    type: 'theme',
    content: JSON.stringify({
      primary: '#FFD700',
      secondary: '#1a0a2e',
      accent: '#FFA500',
      background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)',
      cardBg: 'rgba(255, 215, 0, 0.08)',
      cardBorder: 'rgba(255, 215, 0, 0.25)',
      textPrimary: '#FFD700',
      textSecondary: '#f0e68c',
      glow: '0 0 20px rgba(255, 215, 0, 0.3)'
    }),
    icon: '👑',
    rarity: 'rare',
    requiredTier: 1,
    requiredMonths: 1,
    displayOrder: 1
  },
  {
    name: 'Llamas del Fénix',
    description: 'Tema ardiente con gradientes de fuego y cenizas doradas. Renace como un fénix VIP.',
    type: 'theme',
    content: JSON.stringify({
      primary: '#FF6B35',
      secondary: '#1a0505',
      accent: '#FFD700',
      background: 'linear-gradient(135deg, #1a0505 0%, #3d0c02 30%, #2a0a00 70%, #1a0505 100%)',
      cardBg: 'rgba(255, 107, 53, 0.08)',
      cardBorder: 'rgba(255, 107, 53, 0.25)',
      textPrimary: '#FF8C42',
      textSecondary: '#FFB88C',
      glow: '0 0 20px rgba(255, 107, 53, 0.3)'
    }),
    icon: '🔥',
    rarity: 'epic',
    requiredTier: 2,
    requiredMonths: 3,
    displayOrder: 2
  },
  {
    name: 'Cristal de Hielo',
    description: 'Tema gélido con tonos azul hielo y destellos de escarcha. Elegancia congelada.',
    type: 'theme',
    content: JSON.stringify({
      primary: '#00D4FF',
      secondary: '#0a0a2e',
      accent: '#7DF9FF',
      background: 'linear-gradient(135deg, #0a0a2e 0%, #0d1b3e 40%, #051525 100%)',
      cardBg: 'rgba(0, 212, 255, 0.06)',
      cardBorder: 'rgba(0, 212, 255, 0.2)',
      textPrimary: '#00D4FF',
      textSecondary: '#87CEEB',
      glow: '0 0 20px rgba(0, 212, 255, 0.25)'
    }),
    icon: '❄️',
    rarity: 'epic',
    requiredTier: 3,
    requiredMonths: 6,
    displayOrder: 3
  },
  {
    name: 'Nebulosa Cósmica',
    description: 'Tema espacial con colores de nebulosa, púrpuras profundos y estrellas brillantes.',
    type: 'theme',
    content: JSON.stringify({
      primary: '#E040FB',
      secondary: '#0d0221',
      accent: '#7C4DFF',
      background: 'linear-gradient(135deg, #0d0221 0%, #1a0533 30%, #2d1b69 60%, #0d0221 100%)',
      cardBg: 'rgba(224, 64, 251, 0.06)',
      cardBorder: 'rgba(224, 64, 251, 0.2)',
      textPrimary: '#E040FB',
      textSecondary: '#CE93D8',
      glow: '0 0 25px rgba(224, 64, 251, 0.3)'
    }),
    icon: '🌌',
    rarity: 'legendary',
    requiredTier: 4,
    requiredMonths: 12,
    displayOrder: 4
  },
  {
    name: 'Eternidad Divina',
    description: 'El tema definitivo. Gradientes celestiales con oro, platino y luz divina. Solo para los eternos.',
    type: 'theme',
    content: JSON.stringify({
      primary: '#FFD700',
      secondary: '#0a0020',
      accent: '#E8E8E8',
      background: 'linear-gradient(135deg, #0a0020 0%, #1a0a3e 25%, #2a1a5e 50%, #1a0a3e 75%, #0a0020 100%)',
      cardBg: 'rgba(255, 215, 0, 0.05)',
      cardBorder: 'linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(232, 232, 232, 0.3))',
      textPrimary: '#FFD700',
      textSecondary: '#E8E8E8',
      glow: '0 0 30px rgba(255, 215, 0, 0.4), 0 0 60px rgba(232, 232, 232, 0.1)'
    }),
    icon: '✨',
    rarity: 'legendary',
    requiredTier: 5,
    requiredMonths: 0,
    displayOrder: 5
  }
];

const vipFrames = [
  {
    name: 'Marco Corona Dorada',
    description: 'Un elegante marco dorado con corona. La primera señal de tu estatus VIP.',
    type: 'frame',
    content: 'vip-frame-golden-crown',
    icon: '👑',
    rarity: 'rare',
    requiredTier: 1,
    requiredMonths: 1,
    displayOrder: 1
  },
  {
    name: 'Marco Llamas Ardientes',
    description: 'Marco envuelto en llamas con bordes de fuego. Imponente y poderoso.',
    type: 'frame',
    content: 'vip-frame-fire',
    icon: '🔥',
    rarity: 'epic',
    requiredTier: 2,
    requiredMonths: 3,
    displayOrder: 2
  },
  {
    name: 'Marco Cristal de Hielo',
    description: 'Marco de hielo cristalino con escarcha brillante. Frío y elegante.',
    type: 'frame',
    content: 'vip-frame-ice',
    icon: '❄️',
    rarity: 'epic',
    requiredTier: 3,
    requiredMonths: 6,
    displayOrder: 3
  },
  {
    name: 'Marco Nebulosa Estelar',
    description: 'Marco con efecto de nebulosa cósmica y estrellas giratorias.',
    type: 'frame',
    content: 'vip-frame-nebula',
    icon: '🌌',
    rarity: 'legendary',
    requiredTier: 4,
    requiredMonths: 12,
    displayOrder: 4
  },
  {
    name: 'Marco Eternidad Divina',
    description: 'El marco supremo. Aura divina con partículas de oro y platino.',
    type: 'frame',
    content: 'vip-frame-divine',
    icon: '✨',
    rarity: 'legendary',
    requiredTier: 5,
    requiredMonths: 0,
    displayOrder: 5
  }
];

const vipTitles = [
  {
    name: 'Miembro VIP',
    description: 'Título básico que muestra tu membresía VIP activa.',
    type: 'title',
    content: '⭐ Miembro VIP',
    icon: '⭐',
    rarity: 'rare',
    requiredTier: 1,
    requiredMonths: 1,
    displayOrder: 1
  },
  {
    name: 'Veterano VIP',
    description: 'Has demostrado tu lealtad. Tres meses de apoyo continuo.',
    type: 'title',
    content: '🌟 Veterano VIP',
    icon: '🌟',
    rarity: 'epic',
    requiredTier: 2,
    requiredMonths: 3,
    displayOrder: 2
  },
  {
    name: 'Élite VIP',
    description: 'Medio año de compromiso. Eres parte de la élite de la comunidad.',
    type: 'title',
    content: '💎 Élite VIP',
    icon: '💎',
    rarity: 'epic',
    requiredTier: 3,
    requiredMonths: 6,
    displayOrder: 3
  },
  {
    name: 'Leyenda VIP',
    description: 'Un año completo. Tu nombre resuena en los salones de la fama.',
    type: 'title',
    content: '🏆 Leyenda VIP',
    icon: '🏆',
    rarity: 'legendary',
    requiredTier: 4,
    requiredMonths: 12,
    displayOrder: 4
  },
  {
    name: 'Inmortal VIP',
    description: 'Vitalicio. Tu legado es eterno. El título más exclusivo del foro.',
    type: 'title',
    content: '👑 Inmortal VIP',
    icon: '👑',
    rarity: 'legendary',
    requiredTier: 5,
    requiredMonths: 0,
    displayOrder: 5
  }
];

const vipBadges = [
  {
    name: 'Escudo VIP Bronce',
    description: 'Insignia de bronce VIP. Tu primer paso en el camino dorado.',
    type: 'badge',
    content: 'vip-badge-bronze',
    icon: '🛡️',
    rarity: 'rare',
    requiredTier: 1,
    requiredMonths: 1,
    displayOrder: 1
  },
  {
    name: 'Escudo VIP Plata',
    description: 'Insignia de plata VIP. Tres meses de honor y compromiso.',
    type: 'badge',
    content: 'vip-badge-silver',
    icon: '🔰',
    rarity: 'epic',
    requiredTier: 2,
    requiredMonths: 3,
    displayOrder: 2
  },
  {
    name: 'Escudo VIP Oro',
    description: 'Insignia de oro VIP. Seis meses de gloria y dedicación.',
    type: 'badge',
    content: 'vip-badge-gold',
    icon: '⚜️',
    rarity: 'epic',
    requiredTier: 3,
    requiredMonths: 6,
    displayOrder: 3
  },
  {
    name: 'Escudo VIP Diamante',
    description: 'Insignia de diamante VIP. Un año completo de lealtad inquebrantable.',
    type: 'badge',
    content: 'vip-badge-diamond',
    icon: '💠',
    rarity: 'legendary',
    requiredTier: 4,
    requiredMonths: 12,
    displayOrder: 4
  },
  {
    name: 'Escudo VIP Celestial',
    description: 'La insignia suprema. Solo los VIP vitalicios portan este honor divino.',
    type: 'badge',
    content: 'vip-badge-celestial',
    icon: '🌠',
    rarity: 'legendary',
    requiredTier: 5,
    requiredMonths: 0,
    displayOrder: 5
  }
];

module.exports = {
  vipThemes,
  vipFrames,
  vipTitles,
  vipBadges,
  allVipRewards: [...vipThemes, ...vipFrames, ...vipTitles, ...vipBadges]
};
