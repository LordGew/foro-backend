/**
 * Script para actualizar puntos de usuario para testing
 * Uso: node scripts/updateUserPointsForTesting.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const USER_EMAIL = '1992jairoh@gmail.com';

// Calcular total de puntos necesarios para todos los badges
// Common: 100+150+200+180+220+250+250+300+280+320 = 2,250
// Uncommon: 500+600+700+550+650+800+750+900+700+850 = 7,000
// Rare: 1500+1800+2000+2200+1900+2100+2500 = 13,000
// Epic: 4000+4500+5000+4200+5500 = 23,200
// Legendary: 10000+12000+15000 = 37,000
// TOTAL: 82,450 puntos

const ACHIEVEMENT_POINTS = 100000; // Suficiente para comprar todo
const REFERRAL_POINTS = 50000; // Puntos de referidos adicionales

async function main() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI no está definido en .env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Buscar usuario por email
    const user = await User.findOne({ email: USER_EMAIL });
    
    if (!user) {
      throw new Error(`Usuario con email ${USER_EMAIL} no encontrado`);
    }

    console.log(`\n📧 Usuario encontrado: ${user.username} (${user.email})`);
    console.log(`📊 Puntos actuales:`);
    console.log(`   - Achievement Points: ${user.achievementPoints || 0}`);
    console.log(`   - Referral Points: ${user.referralPoints || 0}`);
    console.log(`   - XP: ${user.xp || 0}`);
    console.log(`   - Nivel: ${Math.floor(Math.sqrt((user.xp || 0) / 10))}`);
    
    // Actualizar puntos
    user.achievementPoints = ACHIEVEMENT_POINTS;
    user.referralPoints = REFERRAL_POINTS;
    user.xp = 100000; // XP alto para nivel alto (nivel ~100)
    
    await user.save();
    
    console.log(`\n✅ Puntos actualizados exitosamente!`);
    console.log(`📊 Nuevos puntos:`);
    console.log(`   - Achievement Points: ${user.achievementPoints}`);
    console.log(`   - Referral Points: ${user.referralPoints}`);
    console.log(`   - XP: ${user.xp}`);
    console.log(`   - Nivel: ${Math.floor(Math.sqrt(user.xp / 10))}`);
    
    console.log(`\n💰 Total disponible para compras: ${ACHIEVEMENT_POINTS + REFERRAL_POINTS} puntos`);
    console.log(`🏅 Costo total de todos los badges: ~82,450 puntos`);
    console.log(`✅ El usuario puede comprar TODOS los badges disponibles`);
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('\n👋 Conexión cerrada');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
