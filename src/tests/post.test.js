const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');

describe('Post API', () => {
  let token, categoryId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: await require('bcryptjs').hash('password123', 12),
    });
    token = require('jsonwebtoken').sign({ userId: user._id, role: 'Player' }, process.env.JWT_SECRET);
    const category = await Category.create({ name: 'Test Category' });
    categoryId = category._id;
  });

  it('should create a post', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test Post', content: 'Content', category: categoryId });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('title', 'Test Post');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase(); // Limpia la base de datos
    await mongoose.connection.close(); // Cierra la conexión
  });
});