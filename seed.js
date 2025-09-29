// seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const Category = require('./src/models/Category');
const AdminSettings = require('./src/models/AdminSettings');
const connectDB = require('./src/config/db');

require('dotenv').config();

const seed = async () => {
  try {
    // --- 1. Crear usuario Admin si no existe ---
    const adminEmail = '1992jairoh@gmail.com';
    const adminUsername = 'Wiggles';  // Agregamos la variable para username
    const existingAdmin = await User.findOne({ 
      $or: [{ email: adminEmail }, { username: adminUsername }] 
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('assassi20', 12);
      await User.create({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: 'Admin',
        xp: 1000,
        rank: 'Master',
      });
      console.log('✅ Usuario Admin creado');
    } else {
      console.log('ℹ️ Usuario Admin ya existe (por email o username)');
    }

    // --- 2. Crear categorías si no existen ---
    const defaultCategories = [
      'Noticias y Comunidad',
      'Discusión General',
      'Guías y Tutoriales',
      'Servidores Privados',
      'Descargas y Recursos',
      'Soporte Técnico',
      'Desarrollo y Emulación',
      'Mercado e Intercambios',
    ];

    const existingCategories = await Category.find({});
    if (existingCategories.length === 0) {
      const categoriesToInsert = defaultCategories.map(name => ({ name }));
      await Category.insertMany(categoriesToInsert);
      console.log('✅ Categorías iniciales creadas');
    } else {
      console.log(`ℹ️ Ya existen ${existingCategories.length} categorías`);
    }

    // --- 3. Crear configuración de administración si no existe ---
    const existingSettings = await AdminSettings.findOne({});
    if (!existingSettings) {
      await AdminSettings.create({
        forumName: 'Wow Community Forum',
        language: 'EN',
        theme: 'wow-dark',
        bannerInterval: 5000,
      });
      console.log('✅ Configuración inicial creada');
    } else {
      console.log('ℹ️ Configuración ya existe');
    }

    console.log('✅ Seed completado con éxito');
  } catch (err) {
    console.error('❌ Error al ejecutar el seed:', err);
    throw err; // Propaga el error para que se capture en el caller (como server.js)
  }
};

// Si se ejecuta directamente (node seed.js), conecta, seed y cierra
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seed();
      await mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      process.exit(1);
    }
  })();
}

module.exports = seed;