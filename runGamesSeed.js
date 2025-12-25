require('dotenv').config();
const mongoose = require('mongoose');
const seedGames = require('./src/seeds/gamesSeed');

const runSeed = async () => {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    
    console.log('🎮 Ejecutando seed de juegos...');
    await seedGames();
    
    console.log('✅ Seed completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

runSeed();
