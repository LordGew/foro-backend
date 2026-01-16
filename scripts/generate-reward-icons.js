const fs = require('fs');
const path = require('path');

// Configuración
const outputDir = path.join(__dirname, '../generated-icons');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Plantilla SVG con parámetros dinámicos
const svgTemplate = (icon, colors) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors[0]}" />
      <stop offset="100%" stop-color="${colors[1]}" />
    </linearGradient>
    ${colors[2] ? `<filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/></filter>` : ''}
  </defs>
  <circle cx="50" cy="50" r="45" fill="url(#grad)" />
  <text x="50" y="50" dy="0.3em" text-anchor="middle" fill="#FFF" font-size="40">${icon}</text>
  ${colors[2] ? `<circle cx="50" cy="50" r="48" stroke="${colors[2]}" stroke-width="1" fill="none" filter="url(#glow)"/>` : ''}
</svg>
`;

// Paleta de colores por rareza
const rarityColors = {
  common: ['#9CA3AF', '#6B7280'],
  rare: ['#60A5FA', '#3B82F6'],
  epic: ['#C084FC', '#A855F7'],
  legendary: ['#FBBF24', '#F59E0B', '#FFD700'] // Dorado para glow
};

// Cargar datos reales
const badgesData = require('../src/data/badges-data');
const rewardsData = require('../src/data/rewards-data');

// Generar SVGs para badges
badgesData.forEach(item => {
  const rarity = item.rarity || 'common';
  const colors = rarityColors[rarity] || rarityColors.common;
  const svg = svgTemplate(item.icon, colors);
  fs.writeFileSync(path.join(outputDir, `badge-${item.slug}.svg`), svg);
});

// Generar SVGs para rewards
rewardsData.forEach(item => {
  const rarity = item.rarity || 'common';
  const colors = rarityColors[rarity] || rarityColors.common;
  const svg = svgTemplate(item.content, colors); // rewards use 'content' for the emoji
  fs.writeFileSync(path.join(outputDir, `reward-${item.slug}.svg`), svg);
});

console.log(`✅ Generados ${badgesData.length + rewardsData.length} íconos SVG en ${outputDir}`);
