const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Post = require('../models/Post');
const Reply = require('../models/Reply');
const Category = require('../models/Category');

const addIndexes = async () => {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    console.log('\n📊 Creando índices para User...');
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ username: 1 }, { unique: true });
    await User.collection.createIndex({ isOnline: 1 });
    await User.collection.createIndex({ vip: 1, vipExpiresAt: 1 });
    await User.collection.createIndex({ xp: -1 });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ lastLogin: -1 });
    console.log('✅ Índices de User creados');

    console.log('\n📊 Creando índices para Post...');
    await Post.collection.createIndex({ slug: 1 }, { unique: true });
    await Post.collection.createIndex({ category: 1, createdAt: -1 });
    await Post.collection.createIndex({ author: 1, createdAt: -1 });
    await Post.collection.createIndex({ createdAt: -1 });
    await Post.collection.createIndex({ title: 'text', content: 'text' });
    console.log('✅ Índices de Post creados');

    console.log('\n📊 Creando índices para Reply...');
    await Reply.collection.createIndex({ post: 1, createdAt: 1 });
    await Reply.collection.createIndex({ author: 1, createdAt: -1 });
    await Reply.collection.createIndex({ parentReply: 1 });
    console.log('✅ Índices de Reply creados');

    console.log('\n📊 Creando índices para Category...');
    await Category.collection.createIndex({ slug: 1 }, { unique: true });
    await Category.collection.createIndex({ name: 1 });
    console.log('✅ Índices de Category creados');

    console.log('\n🎉 Todos los índices fueron creados exitosamente');
    
    console.log('\n📋 Listando índices actuales:');
    const userIndexes = await User.collection.indexes();
    const postIndexes = await Post.collection.indexes();
    const replyIndexes = await Reply.collection.indexes();
    const categoryIndexes = await Category.collection.indexes();
    
    console.log('\nUser indexes:', userIndexes.map(i => i.name).join(', '));
    console.log('Post indexes:', postIndexes.map(i => i.name).join(', '));
    console.log('Reply indexes:', replyIndexes.map(i => i.name).join(', '));
    console.log('Category indexes:', categoryIndexes.map(i => i.name).join(', '));

    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear índices:', error);
    process.exit(1);
  }
};

addIndexes();
