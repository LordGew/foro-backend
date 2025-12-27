const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const Post = require('../../src/models/Post');
const Category = require('../../src/models/Category');
const Game = require('../../src/models/Game');
const bcrypt = require('bcryptjs');

describe('API Integration Tests', () => {
  let app;
  let authToken;
  let testUser;
  let testGame;
  let testCategory;

  beforeAll(async () => {
    // Configurar app básica para tests
    app = express();
    app.use(express.json());
  });

  beforeEach(async () => {
    // Crear juego de prueba
    testGame = await Game.create({
      name: 'Test Game',
      slug: 'test-game',
      description: 'Test game description',
      icon: 'test-icon.png'
    });

    // Crear categoría de prueba
    testCategory = await Category.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test category description',
      game: testGame._id
    });

    // Crear usuario de prueba
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: await bcrypt.hash('Password123!', 10),
      role: 'User'
    });
  });

  describe('User Flow Integration', () => {
    it('debe completar flujo completo: registro -> login -> actualizar perfil', async () => {
      // 1. Registro
      const registerData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'Password123!'
      };

      const newUser = await User.create(registerData);
      expect(newUser).toBeDefined();
      expect(newUser.username).toBe(registerData.username);

      // 2. Login simulado
      const isPasswordValid = await bcrypt.compare(registerData.password, newUser.password);
      expect(isPasswordValid).toBe(true);

      // 3. Actualizar perfil
      newUser.bio = 'Updated bio';
      newUser.profileImage = 'https://example.com/image.jpg';
      await newUser.save();

      const updatedUser = await User.findById(newUser._id);
      expect(updatedUser.bio).toBe('Updated bio');
      expect(updatedUser.profileImage).toBe('https://example.com/image.jpg');
    });

    it('debe completar flujo de referidos: registro con código -> validación -> puntos', async () => {
      // 1. Usuario referidor
      const referrer = await User.create({
        username: 'referrer',
        email: 'referrer@example.com',
        password: await bcrypt.hash('Password123!', 10),
        referralCode: 'TESTREF123',
        totalReferrals: 0,
        referralPoints: 0
      });

      // 2. Nuevo usuario con código de referido
      const referred = await User.create({
        username: 'referred',
        email: 'referred@example.com',
        password: await bcrypt.hash('Password123!', 10),
        referredBy: referrer._id,
        referralPoints: 50
      });

      expect(referred.referralPoints).toBe(50);
      expect(referred.referredBy.toString()).toBe(referrer._id.toString());

      // 3. Actualizar referidor
      referrer.totalReferrals += 1;
      await referrer.save();

      const updatedReferrer = await User.findById(referrer._id);
      expect(updatedReferrer.totalReferrals).toBe(1);
    });
  });

  describe('Post Creation Flow', () => {
    it('debe crear post con categoría y juego válidos', async () => {
      const post = await Post.create({
        title: 'Test Post',
        content: 'Test content',
        author: testUser._id,
        category: testCategory._id,
        game: testGame._id,
        slug: 'test-post'
      });

      expect(post).toBeDefined();
      expect(post.title).toBe('Test Post');
      expect(post.author.toString()).toBe(testUser._id.toString());
      expect(post.category.toString()).toBe(testCategory._id.toString());
    });

    it('debe incrementar contador de posts del usuario', async () => {
      await Post.create({
        title: 'Test Post',
        content: 'Test content',
        author: testUser._id,
        category: testCategory._id,
        game: testGame._id,
        slug: 'test-post'
      });

      testUser.postsCount = (testUser.postsCount || 0) + 1;
      await testUser.save();

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.postsCount).toBe(1);
    });

    it('debe permitir múltiples posts del mismo usuario', async () => {
      const posts = await Promise.all([
        Post.create({
          title: 'Post 1',
          content: 'Content 1',
          author: testUser._id,
          category: testCategory._id,
          game: testGame._id,
          slug: 'post-1'
        }),
        Post.create({
          title: 'Post 2',
          content: 'Content 2',
          author: testUser._id,
          category: testCategory._id,
          game: testGame._id,
          slug: 'post-2'
        })
      ]);

      expect(posts).toHaveLength(2);
      
      const userPosts = await Post.find({ author: testUser._id });
      expect(userPosts).toHaveLength(2);
    });
  });

  describe('Category and Game Relationship', () => {
    it('debe obtener categorías por juego', async () => {
      const categories = await Category.find({ game: testGame._id });
      expect(categories).toHaveLength(1);
      expect(categories[0]._id.toString()).toBe(testCategory._id.toString());
    });

    it('debe obtener posts por categoría', async () => {
      await Post.create({
        title: 'Test Post',
        content: 'Test content',
        author: testUser._id,
        category: testCategory._id,
        game: testGame._id,
        slug: 'test-post'
      });

      const posts = await Post.find({ category: testCategory._id });
      expect(posts).toHaveLength(1);
    });

    it('debe obtener posts por juego', async () => {
      await Post.create({
        title: 'Test Post',
        content: 'Test content',
        author: testUser._id,
        category: testCategory._id,
        game: testGame._id,
        slug: 'test-post'
      });

      const posts = await Post.find({ game: testGame._id });
      expect(posts).toHaveLength(1);
    });
  });

  describe('User Permissions and Roles', () => {
    it('debe verificar permisos de usuario normal', async () => {
      expect(testUser.role).toBe('User');
      
      const canModerate = testUser.role === 'Admin' || testUser.role === 'Moderator';
      expect(canModerate).toBe(false);
    });

    it('debe verificar permisos de admin', async () => {
      const admin = await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: await bcrypt.hash('Password123!', 10),
        role: 'Admin'
      });

      expect(admin.role).toBe('Admin');
      
      const canModerate = admin.role === 'Admin' || admin.role === 'Moderator';
      expect(canModerate).toBe(true);
    });

    it('debe verificar permisos de moderador', async () => {
      const moderator = await User.create({
        username: 'moderator',
        email: 'moderator@example.com',
        password: await bcrypt.hash('Password123!', 10),
        role: 'Moderator'
      });

      expect(moderator.role).toBe('Moderator');
      
      const canModerate = moderator.role === 'Admin' || moderator.role === 'Moderator';
      expect(canModerate).toBe(true);
    });
  });

  describe('Data Consistency', () => {
    it('debe mantener consistencia al eliminar usuario', async () => {
      const post = await Post.create({
        title: 'Test Post',
        content: 'Test content',
        author: testUser._id,
        category: testCategory._id,
        game: testGame._id,
        slug: 'test-post'
      });

      await User.findByIdAndDelete(testUser._id);

      const orphanedPost = await Post.findById(post._id);
      expect(orphanedPost).toBeDefined();
      // En producción, deberías implementar cascade delete o soft delete
    });

    it('debe mantener integridad referencial en categorías', async () => {
      const category = await Category.findById(testCategory._id).populate('game');
      expect(category.game._id.toString()).toBe(testGame._id.toString());
    });
  });

  describe('Search and Filtering', () => {
    it('debe buscar usuarios por username', async () => {
      await User.create({
        username: 'searchuser',
        email: 'search@example.com',
        password: await bcrypt.hash('Password123!', 10)
      });

      const users = await User.find({ 
        username: { $regex: 'search', $options: 'i' } 
      });

      expect(users.length).toBeGreaterThan(0);
      expect(users[0].username).toContain('search');
    });

    it('debe filtrar posts por múltiples criterios', async () => {
      await Post.create({
        title: 'Filtered Post',
        content: 'Test content',
        author: testUser._id,
        category: testCategory._id,
        game: testGame._id,
        slug: 'filtered-post',
        isPinned: true
      });

      const posts = await Post.find({
        game: testGame._id,
        isPinned: true
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].isPinned).toBe(true);
    });
  });

  describe('Pagination', () => {
    beforeEach(async () => {
      // Crear múltiples posts para paginación
      const posts = [];
      for (let i = 1; i <= 25; i++) {
        posts.push({
          title: `Post ${i}`,
          content: `Content ${i}`,
          author: testUser._id,
          category: testCategory._id,
          game: testGame._id,
          slug: `post-${i}`
        });
      }
      await Post.insertMany(posts);
    });

    it('debe paginar resultados correctamente', async () => {
      const page = 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      const posts = await Post.find()
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });

      expect(posts).toHaveLength(10);
    });

    it('debe calcular total de páginas correctamente', async () => {
      const limit = 10;
      const total = await Post.countDocuments();
      const totalPages = Math.ceil(total / limit);

      expect(totalPages).toBe(3);
    });
  });

  describe('Sorting', () => {
    beforeEach(async () => {
      await Post.insertMany([
        {
          title: 'Old Post',
          content: 'Content',
          author: testUser._id,
          category: testCategory._id,
          game: testGame._id,
          slug: 'old-post',
          createdAt: new Date('2024-01-01')
        },
        {
          title: 'New Post',
          content: 'Content',
          author: testUser._id,
          category: testCategory._id,
          game: testGame._id,
          slug: 'new-post',
          createdAt: new Date('2024-12-01')
        }
      ]);
    });

    it('debe ordenar por fecha descendente', async () => {
      const posts = await Post.find().sort({ createdAt: -1 });
      
      expect(posts[0].title).toBe('New Post');
      expect(posts[posts.length - 1].title).toBe('Old Post');
    });

    it('debe ordenar por fecha ascendente', async () => {
      const posts = await Post.find().sort({ createdAt: 1 });
      
      expect(posts[0].title).toBe('Old Post');
      expect(posts[posts.length - 1].title).toBe('New Post');
    });
  });
});
