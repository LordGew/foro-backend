const request = require('supertest');
const { app } = require('../../server');
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Category = require('../models/Category');
const jwt = require('jsonwebtoken');

describe('Post Controller', () => {
  let authToken;
  let userId;
  let categoryId;
  let postId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    const user = await User.create({
      username: 'posttestuser',
      email: 'posttest@example.com',
      password: 'password123',
      role: 'Player'
    });
    userId = user._id;
    authToken = jwt.sign({ userId: user._id.toString(), role: 'Player' }, process.env.JWT_SECRET);

    const category = await Category.findOne({ name: { $exists: true } });
    if (category) {
      categoryId = category._id;
    } else {
      const newCategory = await Category.create({ name: 'Test Category', slug: 'test-category' });
      categoryId = newCategory._id;
    }
  });

  afterAll(async () => {
    await Post.deleteMany({ author: userId });
    await User.deleteOne({ _id: userId });
    await mongoose.connection.close();
  });

  describe('POST /api/posts', () => {
    it('should create a post with valid data', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Post Title',
          content: 'This is a test post content with enough characters.',
          category: categoryId.toString()
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('title', 'Test Post Title');
      expect(res.body).toHaveProperty('slug');
      postId = res.body._id;
    });

    it('should reject post creation without authentication', async () => {
      const res = await request(app)
        .post('/api/posts')
        .send({
          title: 'Unauthorized Post',
          content: 'This should not be created.',
          category: categoryId.toString()
        });

      expect(res.statusCode).toEqual(401);
    });

    it('should reject post with missing fields', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Incomplete Post'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should create unique slugs for duplicate titles', async () => {
      const res1 = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Duplicate Title Test',
          content: 'First post with this title.',
          category: categoryId.toString()
        });

      const res2 = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Duplicate Title Test',
          content: 'Second post with same title.',
          category: categoryId.toString()
        });

      expect(res1.statusCode).toEqual(201);
      expect(res2.statusCode).toEqual(201);
      expect(res1.body.slug).not.toEqual(res2.body.slug);
    });
  });

  describe('GET /api/posts', () => {
    it('should get all posts', async () => {
      const res = await request(app)
        .get('/api/posts');

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter posts by category', async () => {
      const res = await request(app)
        .get('/api/posts')
        .query({ category: categoryId.toString() });

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should search posts by title', async () => {
      const res = await request(app)
        .get('/api/posts')
        .query({ search: 'Test Post' });

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/posts/:param', () => {
    it('should get post by ID', async () => {
      const res = await request(app)
        .get(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('_id', postId);
    });

    it('should get post by slug', async () => {
      const post = await Post.findById(postId);
      const res = await request(app)
        .get(`/api/posts/${post.slug}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('slug', post.slug);
    });

    it('should return 404 for non-existent post', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/posts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /api/posts/:id/like', () => {
    it('should like a post', async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.likes).toContainEqual(expect.objectContaining({ _id: userId.toString() }));
    });

    it('should unlike a post when liked again', async () => {
      await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('should reject like without authentication', async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/like`);

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('POST /api/posts/:id/dislike', () => {
    it('should dislike a post', async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/dislike`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.dislikes).toContainEqual(expect.objectContaining({ _id: userId.toString() }));
    });

    it('should remove like when disliking', async () => {
      await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post(`/api/posts/${postId}/dislike`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.likes).not.toContainEqual(expect.objectContaining({ _id: userId.toString() }));
    });
  });

  describe('DELETE /api/posts/:id', () => {
    it('should delete own post', async () => {
      const newPost = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Post to Delete',
          content: 'This post will be deleted.',
          category: categoryId.toString()
        });

      const res = await request(app)
        .delete(`/api/posts/${newPost.body._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('eliminado');
    });

    it('should reject deletion of non-existent post', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/posts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /api/posts/count', () => {
    it('should return post count', async () => {
      const res = await request(app)
        .get('/api/posts/count');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
    });
  });
});
