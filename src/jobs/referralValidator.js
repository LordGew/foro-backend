const cron = require('node-cron');
const referralController = require('../controllers/referralController');

/**
 * CRON JOB: Validación Automática de Referidos Pendientes
 * 
 * Ejecuta cada 6 horas para validar referidos pendientes
 * y acreditar puntos automáticamente cuando se cumplen los requisitos.
 * 
 * Frecuencia: Cada 6 horas (00:00, 06:00, 12:00, 18:00 UTC)
 * Patrón cron: '0 */6 * * *'
 */

let cronJob = null;

const startReferralValidator = () => {
  // Evitar múltiples instancias del cron job
  if (cronJob) {
    console.log('⚠️ Cron job de validación de referidos ya está en ejecución');
    return;
  }

  // Configurar cron job para ejecutarse cada 6 horas
  cronJob = cron.schedule('0 */6 * * *', async () => {
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 [${timestamp}] Iniciando validación automática de referidos...`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Ejecutar validación de referidos pendientes
      const result = await referralController.validatePendingReferrals(null, null);
      
      console.log('\n📊 Resultado de la validación:');
      console.log(`   ✅ Referidos validados: ${result.validated}`);
      console.log(`   ❌ Referidos cancelados: ${result.cancelled}`);
      console.log(`   ⏳ Aún pendientes: ${result.stillPending}`);
      console.log(`\n${'='.repeat(60)}\n`);
    } catch (error) {
      console.error('\n❌ Error en validación automática de referidos:');
      console.error(error);
      console.log(`\n${'='.repeat(60)}\n`);
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log('✅ Cron job de validación de referidos iniciado');
  console.log('📅 Programado para ejecutarse cada 6 horas (00:00, 06:00, 12:00, 18:00 UTC)');
  console.log('🔍 Validará referidos pendientes y acreditará puntos automáticamente\n');
};

const stopReferralValidator = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('🛑 Cron job de validación de referidos detenido');
  }
};

// Función para ejecutar validación manual (útil para testing)
const runManualValidation = async () => {
  console.log('🔄 Ejecutando validación manual de referidos...\n');
  try {
    const result = await referralController.validatePendingReferrals(null, null);
    console.log('\n✅ Validación manual completada');
    return result;
  } catch (error) {
    console.error('\n❌ Error en validación manual:', error);
    throw error;
  }
};

module.exports = {
  startReferralValidator,
  stopReferralValidator,
  runManualValidation
};
