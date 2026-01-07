const cron = require('node-cron');
const { generateDailyMissions } = require('../controllers/missionController');

// Ejecutar todos los días a las 00:00 (medianoche)
const startDailyMissionReset = () => {
  // Cron: 0 0 * * * = A las 00:00 todos los días
  cron.schedule('0 0 * * *', async () => {
    console.log('🎯 Generando nuevas misiones diarias...');
    try {
      await generateDailyMissions();
      console.log('✅ Misiones diarias generadas exitosamente');
    } catch (err) {
      console.error('❌ Error generando misiones diarias:', err);
    }
  }, {
    timezone: 'America/New_York' // Ajustar según tu zona horaria
  });

  console.log('✅ Cron job de misiones diarias iniciado (00:00 diario)');
};

module.exports = { startDailyMissionReset };
