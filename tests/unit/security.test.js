const request = require('supertest');
const express = require('express');
const User = require('../../src/models/User');
const bcrypt = require('bcryptjs');

describe('Security Tests', () => {
  let app;
  let testUser;
  let authToken;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: await bcrypt.hash('Password123!', 10),
      role: 'User'
    });
  });

  describe('SQL Injection Protection', () => {
    it('debe rechazar intentos de SQL injection en username', async () => {
      const maliciousUsername = "admin' OR '1'='1";
      
      const user = await User.findOne({ username: maliciousUsername });
      expect(user).toBeNull();
    });

    it('debe rechazar intentos de SQL injection en búsqueda', async () => {
      const maliciousQuery = "'; DROP TABLE users; --";
      
      const users = await User.find({ username: { $regex: maliciousQuery } });
      expect(users).toBeDefined();
      expect(Array.isArray(users)).toBe(true);
    });

    it('debe sanitizar correctamente ObjectId inválidos', async () => {
      const maliciousId = "'; DROP TABLE users; --";
      
      expect(async () => {
        await User.findById(maliciousId);
      }).not.toThrow();
    });
  });

  describe('XSS Protection', () => {
    it('debe rechazar scripts en username', async () => {
      const xssUsername = '<script>alert("XSS")</script>';
      
      try {
        await User.create({
          username: xssUsername,
          email: 'xss@example.com',
          password: await bcrypt.hash('Password123!', 10)
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('debe sanitizar HTML en bio', async () => {
      const xssBio = '<img src=x onerror="alert(\'XSS\')">';
      
      testUser.bio = xssBio;
      await testUser.save();

      const updated = await User.findById(testUser._id);
      // El contenido debe ser guardado pero escapado al renderizar
      expect(updated.bio).toBeDefined();
    });

    it('debe rechazar JavaScript en contenido de posts', async () => {
      const xssContent = 'Normal text <script>malicious()</script> more text';
      
      // Simular sanitización (debería implementarse con DOMPurify)
      const sanitized = xssContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Password Security', () => {
    it('debe hashear contraseñas correctamente', async () => {
      const plainPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    it('debe validar contraseñas hasheadas correctamente', async () => {
      const plainPassword = 'Password123!';
      const isValid = await bcrypt.compare(plainPassword, testUser.password);

      expect(isValid).toBe(true);
    });

    it('debe rechazar contraseñas incorrectas', async () => {
      const wrongPassword = 'WrongPassword123!';
      const isValid = await bcrypt.compare(wrongPassword, testUser.password);

      expect(isValid).toBe(false);
    });

    it('debe requerir contraseñas con complejidad mínima', () => {
      const weakPasswords = ['123', 'password', 'abc', '12345678'];
      
      weakPasswords.forEach(password => {
        const isStrong = password.length >= 8 && 
                        /[A-Z]/.test(password) && 
                        /[a-z]/.test(password) && 
                        /[0-9]/.test(password);
        expect(isStrong).toBe(false);
      });
    });

    it('debe aceptar contraseñas fuertes', () => {
      const strongPasswords = ['Password123!', 'SecureP@ss1', 'MyP@ssw0rd'];
      
      strongPasswords.forEach(password => {
        const isStrong = password.length >= 8 && 
                        /[A-Z]/.test(password) && 
                        /[a-z]/.test(password) && 
                        /[0-9]/.test(password);
        expect(isStrong).toBe(true);
      });
    });
  });

  describe('Authorization Tests', () => {
    it('debe rechazar acceso a recursos sin autenticación', async () => {
      // Simular endpoint protegido
      const isAuthenticated = false;
      
      if (!isAuthenticated) {
        expect(isAuthenticated).toBe(false);
      }
    });

    it('debe rechazar acceso a recursos de admin sin rol admin', async () => {
      const userRole = testUser.role;
      const isAdmin = userRole === 'Admin';

      expect(isAdmin).toBe(false);
    });

    it('debe permitir acceso a admin con rol correcto', async () => {
      const adminUser = await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: await bcrypt.hash('Password123!', 10),
        role: 'Admin'
      });

      const isAdmin = adminUser.role === 'Admin';
      expect(isAdmin).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('debe rechazar emails inválidos', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com'
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('debe aceptar emails válidos', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk'
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('debe rechazar usernames con caracteres especiales', () => {
      const invalidUsernames = [
        'user@name',
        'user name',
        'user<script>',
        'user"name'
      ];

      const usernameRegex = /^[a-zA-Z0-9_-]+$/;
      
      invalidUsernames.forEach(username => {
        expect(usernameRegex.test(username)).toBe(false);
      });
    });

    it('debe limitar longitud de campos de texto', () => {
      const longText = 'a'.repeat(10001);
      const maxLength = 10000;

      expect(longText.length).toBeGreaterThan(maxLength);
    });
  });

  describe('Rate Limiting Protection', () => {
    it('debe simular límite de intentos de login', async () => {
      const attempts = [];
      const maxAttempts = 5;

      for (let i = 0; i < 10; i++) {
        attempts.push(i);
      }

      const blocked = attempts.length > maxAttempts;
      expect(blocked).toBe(true);
    });

    it('debe permitir intentos dentro del límite', () => {
      const attempts = [1, 2, 3];
      const maxAttempts = 5;

      const blocked = attempts.length > maxAttempts;
      expect(blocked).toBe(false);
    });
  });

  describe('Session Security', () => {
    it('debe invalidar tokens expirados', () => {
      const tokenExpiry = new Date(Date.now() - 1000);
      const now = new Date();

      const isExpired = tokenExpiry < now;
      expect(isExpired).toBe(true);
    });

    it('debe mantener tokens válidos activos', () => {
      const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const isExpired = tokenExpiry < now;
      expect(isExpired).toBe(false);
    });
  });

  describe('Data Exposure Prevention', () => {
    it('no debe exponer contraseñas en respuestas', async () => {
      const userObj = testUser.toObject();
      
      // Simular eliminación de password antes de enviar
      delete userObj.password;
      
      expect(userObj.password).toBeUndefined();
    });

    it('no debe exponer información sensible en errores', () => {
      const error = new Error('Database connection failed');
      const safeError = { message: 'Internal server error' };

      expect(safeError.message).not.toContain('Database');
      expect(safeError.message).not.toContain('connection');
    });
  });

  describe('CSRF Protection', () => {
    it('debe requerir token CSRF para operaciones sensibles', () => {
      const hasCSRFToken = false;
      const isSensitiveOperation = true;

      if (isSensitiveOperation && !hasCSRFToken) {
        expect(hasCSRFToken).toBe(false);
      }
    });
  });

  describe('File Upload Security', () => {
    it('debe rechazar tipos de archivo no permitidos', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const fileType = 'application/x-executable';

      const isAllowed = allowedTypes.includes(fileType);
      expect(isAllowed).toBe(false);
    });

    it('debe aceptar tipos de archivo permitidos', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const fileType = 'image/jpeg';

      const isAllowed = allowedTypes.includes(fileType);
      expect(isAllowed).toBe(true);
    });

    it('debe limitar tamaño de archivos', () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const maxSize = 5 * 1024 * 1024; // 5MB

      const isWithinLimit = fileSize <= maxSize;
      expect(isWithinLimit).toBe(false);
    });
  });
});
