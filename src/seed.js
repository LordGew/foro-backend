const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Category = require('./models/Category');
const AdminSettings = require('./models/AdminSettings');
const connectDB = require('./config/db'); // Reutilizamos la conexión de config/db.js

require('dotenv').config(); // Añade esta línea al inicio

const seed = async () => {
  try {
    await connectDB();
    await mongoose.connection.dropDatabase(); // Cuidado: borra todo

    // Admin user
    const hashedPassword = await bcrypt.hash('assassi20', 12);
    await User.create({
      username: 'Admin',
      email: 'test@gmail.com',
      password: hashedPassword,
      role: 'Admin',
      xp: 1000,
      rank: 'Master',
    });

    // Categorías iniciales
    await Category.insertMany([
  { name: 'Noticias y Comunidad' },
  { name: 'Discusión General' },
  { name: 'Guías y Tutoriales' },
  { name: 'Servidores Privados' },
  { name: 'Descargas y Recursos' },
  { name: 'Soporte Técnico' },
  { name: 'Desarrollo y Emulación' },
  { name: 'Mercado e Intercambios' }
]);

    // Settings iniciales
    await AdminSettings.create({
      forumName: 'World of Warcraft Forum',
      language: 'EN',
      theme: 'wow-dark',
      bannerInterval: 5000,
    });

    console.log('Database seeded');
    mongoose.connection.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();