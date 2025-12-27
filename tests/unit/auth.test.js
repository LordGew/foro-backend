const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');
const { register, login } = require('../../src/controllers/userController');

// Mock app para tests
const app = express();
app.use(express.json());
app.post('/register', register);
app.post('/login', login);

describe('Authentication Tests', () => {
  describe('POST /register', () => {
    it('debe registrar un nuevo usuario exitosamente', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', userData.username);
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('debe rechazar registro con username duplicado', async () => {
      const userData = {
        username: 'testuser',
        email: 'test1@example.com',
        password: 'Password123!'
      };

      await User.create({
        username: 'testuser',
        email: 'existing@example.com',
        password: await bcrypt.hash('Password123!', 10)
      });

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('debe rechazar registro con email duplicado', async () => {
      const userData = {
        username: 'newuser',
        email: 'test@example.com',
        password: 'Password123!'
      };

      await User.create({
        username: 'existinguser',
        email: 'test@example.com',
        password: await bcrypt.hash('Password123!', 10)
      });

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('debe rechazar registro con contraseña débil', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('debe rechazar registro con email inválido', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: await bcrypt.hash('Password123!', 10),
        role: 'User'
      });
    });

    it('debe hacer login exitosamente con credenciales válidas', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'Password123!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', 'testuser');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('debe rechazar login con contraseña incorrecta', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('debe rechazar login con usuario inexistente', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'nonexistent',
          password: 'Password123!'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('debe rechazar login sin credenciales', async () => {
      const response = await request(app)
        .post('/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('JWT Token Validation', () => {
    it('debe generar un token JWT válido', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: await bcrypt.hash('Password123!', 10)
      });

      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('username', 'testuser');
    });

    it('debe rechazar token expirado', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: await bcrypt.hash('Password123!', 10)
      });

      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).toThrow();
    });

    it('debe rechazar token con firma inválida', () => {
      const token = 'invalid.token.signature';

      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).toThrow();
    });
  });
});
