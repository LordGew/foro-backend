const mongoose = require('mongoose');
const Post = require('../models/Post');
const Game = require('../models/Game');
require('dotenv').config();

const migratePostsToGame = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Obtener el primer juego (World of Warcraft por defecto)
    const defaultGame = await Game.findOne({ slug: 'world-of-warcraft' });
    
    if (!defaultGame) {
      console.error('❌ No se encontró el juego por defecto');
      process.exit(1);
    }

    console.log(`📝 Juego por defecto: ${defaultGame.name} (${defaultGame._id})`);

    // Actualizar todos los posts que no tengan el campo game
    const result = await Post.updateMany(
      { game: { $exists: false } },
      { $set: { game: defaultGame._id } }
    );

    console.log(`✅ ${result.modifiedCount} posts actualizados con el juego por defecto`);

    // Verificar posts actualizados
    const totalPosts = await Post.countDocuments();
    const postsWithGame = await Post.countDocuments({ game: { $exists: true } });
    
    console.log(`📊 Total de posts: ${totalPosts}`);
    console.log(`📊 Posts con game: ${postsWithGame}`);

    await mongoose.connection.close();
    console.log('✅ Migración completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
};

migratePostsToGame();
