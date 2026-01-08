/**
 * Script para ejecutar el seed de badges directamente
 * Uso: node scripts/executeSeedBadges.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const seedBadges = require('../src/seeds/badgesSeed');

async function main() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI no está definido en .env');
    }

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Conectado a MongoDB');
    
    // Ejecutar seed
    const badges = await seedBadges();
    
    console.log(`\n🎉 Seed completado exitosamente!`);
    console.log(`📊 Total de badges creados: ${badges.length}`);
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('👋 Conexión cerrada');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
