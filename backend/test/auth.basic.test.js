const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/User');
const { initTestEnvironment, cleanupTestEnvironment } = require('./test-utils');

// Test user data
const testUser = {
  name: 'Test User',
  email: 'test@test.com',
  password: 'password123',
  phone: '0123456789',
  role: 'user'
};

describe('Basic Authentication Tests', () => {
  let baseUrl;
  let authToken;

  // Setup test environment
  beforeAll(async () => {
    const { baseUrl: url } = await initTestEnvironment();
    baseUrl = url;
  });

  // Clean up after tests
  afterAll(async () => {
    await User.deleteMany({});
    await cleanupTestEnvironment();
  });

  // Clean up test data between tests
  afterEach(async () => {
    await User.deleteMany({});
  });

  // Test registration
  describe('User Registration', () => {
    it('should register a new user', async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('name', testUser.name);
      expect(res.body.user).toHaveProperty('email', testUser.email);
    });
  });

  // Test login
  describe('User Login', () => {
    // Register a test user first
    beforeAll(async () => {
      await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(testUser);
    });

    it('should login with valid credentials', async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', testUser.email);
    });
  });
});
