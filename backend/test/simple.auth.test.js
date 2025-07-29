const request = require('supertest');
const mongoose = require('mongoose');
const { initTestEnvironment, cleanupTestEnvironment, getBaseUrl } = require('./test-utils');

// Mock required modules
jest.mock('jsonwebtoken', () => ({
  sign: () => 'test_token',
  verify: () => ({ id: 'test_user_id' })
}));

jest.mock('bcryptjs', () => ({
  hash: (password, salt, callback) => callback(null, 'hashed_' + password),
  compare: (password, hashed, callback) => callback(null, true)
}));

describe('Simple Auth Tests', () => {
  beforeAll(async () => {
    await initTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  it('should connect to the in-memory database', () => {
    expect(mongoose.connection.readyState).toBe(1); // 1 means connected
  });

  it('should respond to test route', async () => {
    const response = await request(getBaseUrl())
      .get('/api/v1/test')
      .send({});
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.message).toBe('Test route is working');
  });
});
