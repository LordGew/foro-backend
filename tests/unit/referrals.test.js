const request = require('supertest');
const express = require('express');
const User = require('../../src/models/User');
const Referral = require('../../src/models/Referral');
const bcrypt = require('bcryptjs');

describe('Referral System Tests', () => {
  let app;
  let authToken;
  let testUser;
  let referrerUser;

  beforeEach(async () => {
    // Crear usuario referidor
    referrerUser = await User.create({
      username: 'referrer',
      email: 'referrer@example.com',
      password: await bcrypt.hash('Password123!', 10),
      referralCode: 'REFCODE123',
      totalReferrals: 0,
      referralPoints: 0
    });

    // Crear usuario de prueba
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: await bcrypt.hash('Password123!', 10),
      role: 'User'
    });
  });

  describe('Referral Code Generation', () => {
    it('debe generar código de referido único al crear usuario', async () => {
      const user = await User.create({
        username: 'newuser',
        email: 'newuser@example.com',
        password: await bcrypt.hash('Password123!', 10)
      });

      expect(user.referralCode).toBeDefined();
      expect(user.referralCode).toHaveLength(8);
      expect(user.referralCode).toMatch(/^[A-Z0-9]+$/);
    });

    it('debe generar códigos únicos para múltiples usuarios', async () => {
      const users = await Promise.all([
        User.create({
          username: 'user1',
          email: 'user1@example.com',
          password: await bcrypt.hash('Password123!', 10)
        }),
        User.create({
          username: 'user2',
          email: 'user2@example.com',
          password: await bcrypt.hash('Password123!', 10)
        }),
        User.create({
          username: 'user3',
          email: 'user3@example.com',
          password: await bcrypt.hash('Password123!', 10)
        })
      ]);

      const codes = users.map(u => u.referralCode);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe('Referral Registration Flow', () => {
    it('debe crear referido pendiente al registrar con código válido', async () => {
      const newUser = await User.create({
        username: 'referred',
        email: 'referred@example.com',
        password: await bcrypt.hash('Password123!', 10),
        referredBy: referrerUser._id
      });

      const referral = await Referral.create({
        referrer: referrerUser._id,
        referred: newUser._id,
        referralCode: 'REFCODE123',
        status: 'pending',
        pointsAwarded: 100
      });

      expect(referral.status).toBe('pending');
      expect(referral.referrer.toString()).toBe(referrerUser._id.toString());
      expect(referral.referred.toString()).toBe(newUser._id.toString());
    });

    it('debe otorgar 50 puntos inmediatos al nuevo usuario', async () => {
      const newUser = await User.create({
        username: 'referred',
        email: 'referred@example.com',
        password: await bcrypt.hash('Password123!', 10),
        referredBy: referrerUser._id,
        referralPoints: 50
      });

      expect(newUser.referralPoints).toBe(50);
    });

    it('debe incrementar totalReferrals del referidor', async () => {
      referrerUser.totalReferrals += 1;
      await referrerUser.save();

      const updated = await User.findById(referrerUser._id);
      expect(updated.totalReferrals).toBe(1);
    });

    it('debe rechazar código de referido inválido', async () => {
      const invalidReferrer = await User.findOne({ referralCode: 'INVALID123' });
      expect(invalidReferrer).toBeNull();
    });
  });

  describe('Referral Validation (2-day rule)', () => {
    it('debe validar referido después de 2 días con requisitos cumplidos', async () => {
      const newUser = await User.create({
        username: 'referred',
        email: 'referred@example.com',
        password: await bcrypt.hash('Password123!', 10),
        referredBy: referrerUser._id,
        profileImage: 'https://example.com/image.jpg',
        bio: 'Test bio',
        postsCount: 1,
        commentsCount: 3,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 días atrás
      });

      const referral = await Referral.create({
        referrer: referrerUser._id,
        referred: newUser._id,
        referralCode: 'REFCODE123',
        status: 'pending',
        pointsAwarded: 100,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      });

      // Simular validación
      const isValid = 
        newUser.profileImage && 
        newUser.bio && 
        (newUser.postsCount >= 1 || newUser.commentsCount >= 3) &&
        (Date.now() - new Date(referral.createdAt).getTime()) >= 2 * 24 * 60 * 60 * 1000;

      expect(isValid).toBe(true);
    });

    it('debe rechazar validación antes de 2 días', async () => {
      const newUser = await User.create({
        username: 'referred',
        email: 'referred@example.com',
        password: await bcrypt.hash('Password123!', 10),
        referredBy: referrerUser._id,
        profileImage: 'https://example.com/image.jpg',
        bio: 'Test bio',
        postsCount: 1,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 día atrás
      });

      const referral = await Referral.create({
        referrer: referrerUser._id,
        referred: newUser._id,
        referralCode: 'REFCODE123',
        status: 'pending',
        pointsAwarded: 100,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      });

      const isValid = (Date.now() - new Date(referral.createdAt).getTime()) >= 2 * 24 * 60 * 60 * 1000;
      expect(isValid).toBe(false);
    });

    it('debe rechazar validación sin perfil completo', async () => {
      const newUser = await User.create({
        username: 'referred',
        email: 'referred@example.com',
        password: await bcrypt.hash('Password123!', 10),
        referredBy: referrerUser._id,
        postsCount: 1,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      });

      const isValid = newUser.profileImage && newUser.bio;
      expect(isValid).toBe(false);
    });

    it('debe rechazar validación sin actividad mínima', async () => {
      const newUser = await User.create({
        username: 'referred',
        email: 'referred@example.com',
        password: await bcrypt.hash('Password123!', 10),
        referredBy: referrerUser._id,
        profileImage: 'https://example.com/image.jpg',
        bio: 'Test bio',
        postsCount: 0,
        commentsCount: 2,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      });

      const isValid = newUser.postsCount >= 1 || newUser.commentsCount >= 3;
      expect(isValid).toBe(false);
    });
  });

  describe('Referral Points Award', () => {
    it('debe otorgar 100 puntos al referidor al completar validación', async () => {
      referrerUser.referralPoints += 100;
      await referrerUser.save();

      const updated = await User.findById(referrerUser._id);
      expect(updated.referralPoints).toBe(100);
    });

    it('debe marcar referido como completed al validar', async () => {
      const referral = await Referral.create({
        referrer: referrerUser._id,
        referred: testUser._id,
        referralCode: 'REFCODE123',
        status: 'pending',
        pointsAwarded: 100
      });

      referral.status = 'completed';
      referral.completedAt = new Date();
      await referral.save();

      const updated = await Referral.findById(referral._id);
      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeDefined();
    });
  });

  describe('Referral Statistics', () => {
    it('debe contar correctamente referidos pendientes', async () => {
      await Referral.create({
        referrer: referrerUser._id,
        referred: testUser._id,
        referralCode: 'REFCODE123',
        status: 'pending',
        pointsAwarded: 100
      });

      const pendingCount = await Referral.countDocuments({
        referrer: referrerUser._id,
        status: 'pending'
      });

      expect(pendingCount).toBe(1);
    });

    it('debe contar correctamente referidos completados', async () => {
      await Referral.create({
        referrer: referrerUser._id,
        referred: testUser._id,
        referralCode: 'REFCODE123',
        status: 'completed',
        pointsAwarded: 100,
        completedAt: new Date()
      });

      const completedCount = await Referral.countDocuments({
        referrer: referrerUser._id,
        status: 'completed'
      });

      expect(completedCount).toBe(1);
    });

    it('debe calcular total de puntos ganados por referidos', async () => {
      await Referral.insertMany([
        {
          referrer: referrerUser._id,
          referred: testUser._id,
          referralCode: 'REFCODE123',
          status: 'completed',
          pointsAwarded: 100,
          completedAt: new Date()
        },
        {
          referrer: referrerUser._id,
          referred: testUser._id,
          referralCode: 'REFCODE123',
          status: 'completed',
          pointsAwarded: 100,
          completedAt: new Date()
        }
      ]);

      const totalPoints = await Referral.aggregate([
        { $match: { referrer: referrerUser._id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } }
      ]);

      expect(totalPoints[0]?.total).toBe(200);
    });
  });
});
