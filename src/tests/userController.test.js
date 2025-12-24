const request = require('supertest');
const { app } = require('../../server');
const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

describe('User Controller', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /test.*@example\.com/ } });
    await mongoose.connection.close();
  });

  describe('POST /api/users/register', () => {
    it('should register a new user with valid data', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser123',
          email: 'testuser123@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User registered');
    });

    it('should reject registration with short password', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser2',
          email: 'testuser2@example.com',
          password: 'short'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Invalid input');
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser3',
          email: 'invalid-email',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should reject duplicate username', async () => {
      await request(app)
        .post('/api/users/register')
        .send({
          username: 'duplicateuser',
          email: 'duplicate1@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'duplicateuser',
          email: 'duplicate2@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Username already taken');
    });
  });

  describe('POST /api/users/login', () => {
    beforeAll(async () => {
      await request(app)
        .post('/api/users/register')
        .send({
          username: 'logintest',
          email: 'logintest@example.com',
          password: 'password123'
        });
    });

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: 'logintest@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('username', 'logintest');
      
      authToken = res.body.token;
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: 'logintest@example.com',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toContain('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/users/profile', () => {
    it('should get user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('username');
      expect(res.body).not.toHaveProperty('password');
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/users/profile');

      expect(res.statusCode).toEqual(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('PATCH /api/users/update-password', () => {
    it('should update password with correct current password', async () => {
      const res = await request(app)
        .patch('/api/users/update-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123',
          confirmNewPassword: 'newpassword123'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('actualizada');
    });

    it('should reject password update with wrong current password', async () => {
      const res = await request(app)
        .patch('/api/users/update-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456',
          confirmNewPassword: 'newpassword456'
        });

      expect(res.statusCode).toEqual(401);
    });

    it('should reject password update with mismatched passwords', async () => {
      const res = await request(app)
        .patch('/api/users/update-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'newpassword123',
          newPassword: 'different1',
          confirmNewPassword: 'different2'
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /api/users/search', () => {
    it('should search users by username', async () => {
      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'logintest' });

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return empty array for non-existent user', async () => {
      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'nonexistentuser12345' });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /api/users/count', () => {
    it('should return user count', async () => {
      const res = await request(app)
        .get('/api/users/count');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
    });
  });
});
