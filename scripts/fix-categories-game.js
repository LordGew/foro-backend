const mongoose = require('mongoose');
require('dotenv').config();

// Conectar a MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/foro-wow')
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => {
    console.error('❌ Error al conectar a MongoDB:', err);
    process.exit(1);
  });

const Category = require('../src/models/Category');
const Game = require('../src/models/Game');

async function fixCategoriesGame() {
  try {
    console.log('\n🔍 Buscando juego "World of Warcraft"...');
    
    // Buscar el juego World of Warcraft
    const wowGame = await Game.findOne({ name: 'World of Warcraft' });
    
    if (!wowGame) {
      console.error('❌ No se encontró el juego "World of Warcraft"');
      console.log('📋 Juegos disponibles:');
      const allGames = await Game.find({});
      allGames.forEach(game => {
        console.log(`   - ${game.name} (ID: ${game._id})`);
      });
      process.exit(1);
    }
    
    console.log(`✅ Juego encontrado: ${wowGame.name} (ID: ${wowGame._id})`);
    
    // Buscar todas las categorías sin juego asignado o con juego null
    console.log('\n🔍 Buscando categorías sin juego asignado...');
    const categoriesWithoutGame = await Category.find({
      $or: [
        { game: null },
        { game: { $exists: false } }
      ]
    });
    
    console.log(`📋 Categorías sin juego: ${categoriesWithoutGame.length}`);
    
    if (categoriesWithoutGame.length === 0) {
      console.log('✅ Todas las categorías ya tienen un juego asignado');
      
      // Mostrar todas las categorías con su juego
      console.log('\n📋 Lista de todas las categorías:');
      const allCategories = await Category.find({}).populate('game', 'name');
      allCategories.forEach(cat => {
        console.log(`   - ${cat.name}: ${cat.game ? cat.game.name : 'SIN JUEGO'}`);
      });
      
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // Listar las categorías que se van a actualizar
    console.log('\n📝 Categorías que se actualizarán:');
    categoriesWithoutGame.forEach(cat => {
      console.log(`   - ${cat.name}`);
    });
    
    // Actualizar todas las categorías sin juego
    console.log(`\n🔄 Asignando juego "${wowGame.name}" a ${categoriesWithoutGame.length} categorías...`);
    
    const result = await Category.updateMany(
      {
        $or: [
          { game: null },
          { game: { $exists: false } }
        ]
      },
      {
        $set: { game: wowGame._id }
      }
    );
    
    console.log(`✅ Actualización completada: ${result.modifiedCount} categorías actualizadas`);
    
    // Verificar el resultado
    console.log('\n🔍 Verificando resultado...');
    const updatedCategories = await Category.find({}).populate('game', 'name');
    
    console.log('\n📋 Estado final de las categorías:');
    updatedCategories.forEach(cat => {
      console.log(`   - ${cat.name}: ${cat.game ? cat.game.name : '❌ SIN JUEGO'}`);
    });
    
    const stillWithoutGame = updatedCategories.filter(cat => !cat.game);
    if (stillWithoutGame.length > 0) {
      console.log(`\n⚠️ Advertencia: ${stillWithoutGame.length} categorías aún sin juego`);
    } else {
      console.log('\n✅ Todas las categorías tienen un juego asignado correctamente');
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error al ejecutar el script:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Ejecutar el script
fixCategoriesGame();
