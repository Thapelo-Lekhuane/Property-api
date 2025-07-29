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

// Test suite for Authentication
describe('Authentication API', () => {
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
  beforeEach(async () => {
    await User.deleteMany({});
  });

  // Test registration
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('name', testUser.name);
      expect(res.body.user).toHaveProperty('email', testUser.email);
      
      // Save the token for future authenticated requests
      if (res.body.token) {
        authToken = res.body.token;
      }
    });

    it('should not register user with duplicate email', async () => {
      // First register the user
      await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      // Try to register again with same email
      const res = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should not register user with missing fields', async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send({ name: 'Incomplete User' });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test login
  describe('POST /api/v1/auth/login', () => {
    // Register a test user first
    beforeAll(async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      // Save the token from registration
      if (res.body.token) {
        authToken = res.body.token;
      }
    });

    it('should login user and return token', async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', testUser.email);
      
      // Update the auth token
      if (res.body.token) {
        authToken = res.body.token;
      }
    });

    it('should not login with incorrect password', async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should not login with non-existent email', async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test get current user
  describe('GET /api/v1/auth/me', () => {
    let token;

    beforeAll(async () => {
      // Login to get token
      const res = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      token = res.body.token;
    });

    it('should get current user with valid token', async () => {
      const res = await request
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('email', testUser.email);
    });

    it('should not get user without token', async () => {
      const res = await request
        .get('/api/v1/auth/me');

      expect(res.statusCode).toEqual(401);
    });
  });

  // Test update user details
  describe('PUT /api/v1/auth/updatedetails', () => {
    let token;

    beforeAll(async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      token = res.body.token;
    });

    it('should update user details', async () => {
      const res = await request
        .put('/api/v1/auth/updatedetails')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          email: 'updated@test.com'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('name', 'Updated Name');
      expect(res.body.data).toHaveProperty('email', 'updated@test.com');

      // Revert changes
      await User.findOneAndUpdate(
        { email: 'updated@test.com' },
        { name: testUser.name, email: testUser.email }
      );
    });
  });

  // Test update password
  describe('PUT /api/v1/auth/updatepassword', () => {
    let token;

    beforeAll(async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      token = res.body.token;
    });

    it('should update user password', async () => {
      const res = await request
        .put('/api/v1/auth/updatepassword')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'newpassword123'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');

      // Test login with new password
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'newpassword123'
        });

      expect(loginRes.statusCode).toEqual(200);
      expect(loginRes.body).toHaveProperty('token');

      // Revert password change
      const user = await User.findOne({ email: testUser.email });
      user.password = testUser.password;
      await user.save();
    });

    it('should not update password with wrong current password', async () => {
      const res = await request
        .put('/api/v1/auth/updatepassword')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test forgot password
  describe('POST /api/v1/auth/forgotpassword', () => {
    // Register a test user first
    beforeAll(async () => {
      await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(testUser);
    });

    it('should send reset password email', async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/forgotpassword')
        .send({ email: testUser.email });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should return success even if email does not exist', async () => {
      const res = await request(baseUrl)
        .post('/api/v1/auth/forgotpassword')
        .send({ email: 'nonexistent@test.com' });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  // Test reset password
  describe('PUT /api/v1/auth/resetpassword/:resettoken', () => {
    let resetToken;

    beforeAll(async () => {
      // Generate reset token
      const user = await User.findOne({ email: testUser.email });
      resetToken = user.getResetPasswordToken();
      await user.save({ validateBeforeSave: false });
    });

    it('should reset password with valid token', async () => {
      const res = await request
        .put(`/api/v1/auth/resetpassword/${resetToken}`)
        .send({
          password: 'newpassword123'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');

      // Test login with new password
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'newpassword123'
        });

      expect(loginRes.statusCode).toEqual(200);
      expect(loginRes.body).toHaveProperty('token');

      // Revert password change
      const user = await User.findOne({ email: testUser.email });
      user.password = testUser.password;
      await user.save();
    });

    it('should not reset password with invalid token', async () => {
      const res = await request
        .put('/api/v1/auth/resetpassword/invalidtoken')
        .send({
          password: 'newpassword123'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

});

// Test get current user
describe('GET /api/v1/auth/me', () => {
  let token;

  beforeAll(async () => {
    const res = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    token = res.body.token;
  });

  it('should get current user with valid token', async () => {
    const res = await request(baseUrl)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('email', testUser.email);
  });

  it('should not get user without token', async () => {
    const res = await request(baseUrl)
      .get('/api/v1/auth/me');

    expect(res.statusCode).toEqual(401);
  });
});

// Test update user details
describe('PUT /api/v1/auth/updatedetails', () => {
  let token;

  beforeAll(async () => {
    const res = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    token = res.body.token;
  });

  it('should update user details', async () => {
    const res = await request(baseUrl)
      .put('/api/v1/auth/updatedetails')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name',
        email: 'updated@test.com'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('name', 'Updated Name');
    expect(res.body.data).toHaveProperty('email', 'updated@test.com');

    // Revert changes
    await User.findOneAndUpdate(
      { email: 'updated@test.com' },
      { name: testUser.name, email: testUser.email }
    );
  });
});

// Test update password
describe('PUT /api/v1/auth/updatepassword', () => {
  let token;

  beforeAll(async () => {
    const res = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    token = res.body.token;
  });

  it('should update user password', async () => {
    const res = await request(baseUrl)
      .put('/api/v1/auth/updatepassword')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: testUser.password,
        newPassword: 'newpassword123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');

    // Test login with new password
    const loginRes = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'newpassword123'
      });

    expect(loginRes.statusCode).toEqual(200);
    expect(loginRes.body).toHaveProperty('token');

    // Revert password change
    const user = await User.findOne({ email: testUser.email });
    user.password = testUser.password;
    await user.save();
  });

  it('should not update password with wrong current password', async () => {
    const res = await request(baseUrl)
      .put('/api/v1/auth/updatepassword')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('success', false);
  });
});

// Test forgot password
describe('POST /api/v1/auth/forgotpassword', () => {
  // Register a test user first
  beforeAll(async () => {
    await request(baseUrl)
      .post('/api/v1/auth/register')
      .send(testUser);
  });

  it('should send reset password email', async () => {
    const res = await request(baseUrl)
      .post('/api/v1/auth/forgotpassword')
      .send({ email: testUser.email });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
  });

  it('should return success even if email does not exist', async () => {
    const res = await request(baseUrl)
      .post('/api/v1/auth/forgotpassword')
      .send({ email: 'nonexistent@test.com' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

// Test reset password
describe('PUT /api/v1/auth/resetpassword/:resettoken', () => {
  let resetToken;

  beforeAll(async () => {
    // Generate reset token
    const user = await User.findOne({ email: testUser.email });
    resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });
  });

  it('should reset password with valid token', async () => {
    const res = await request(baseUrl)
      .put(`/api/v1/auth/resetpassword/${resetToken}`)
      .send({
        password: 'newpassword123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');

    // Test login with new password
    const loginRes = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'newpassword123'
      });

    expect(loginRes.statusCode).toEqual(200);
    expect(loginRes.body).toHaveProperty('token');

    // Revert password change
    const user = await User.findOne({ email: testUser.email });
    user.password = testUser.password;
    await user.save();
  });

  it('should not reset password with invalid token', async () => {
    const res = await request(baseUrl)
      .put('/api/v1/auth/resetpassword/invalidtoken')
      .send({
        password: 'newpassword123'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('success', false);
  });
});

// Test logout
describe('GET /api/v1/auth/logout', () => {
  let token;

  beforeAll(async () => {
    // Register user first
    await request(baseUrl)
      .post('/api/v1/auth/register')
      .send(testUser);
        
    // Then login to get token
    const res = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    token = res.body.token;
  });

  it('should clear cookie and log out user', async () => {
    const res = await request(baseUrl)
      .get('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
