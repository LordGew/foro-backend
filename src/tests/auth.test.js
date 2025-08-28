const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');

describe('Auth API', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  it('should register a user', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'testuser', email: 'test@example.com', password: 'password123' });
    if (res.statusCode !== 201) {
      console.log('Error body:', res.body);  // Para debug si falla
    }
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'User registered');
  });

  it('should login a user', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ username: 'testuser2', email: 'test2@example.com', password: 'password123' });
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'test2@example.com', password: 'password123' });
    if (res.statusCode !== 200) {
      console.log('Error body:', res.body);  // Para debug si falla
    }
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
  });
});