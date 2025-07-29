const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');

// Mock Firebase Admin SDK before requiring it
let mockAuth, mockFirestore;

jest.mock('firebase-admin', () => {
  mockAuth = {
    createUser: jest.fn(),
    getUserByEmail: jest.fn(),
    deleteUser: jest.fn(),
    verifyIdToken: jest.fn(),
    setCustomUserClaims: jest.fn(),
    getUser: jest.fn()
  };

  mockFirestore = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn()
      }))
    }))
  };

  return {
    apps: [],
    initializeApp: jest.fn(),
    auth: jest.fn(() => mockAuth),
    firestore: jest.fn(() => mockFirestore),
    credential: {
      cert: jest.fn()
    }
  };
});

// Now require firebase-admin after setting up the mock
const admin = require('firebase-admin');
const auth = admin.auth();
const db = admin.firestore();

// Create a test server instance
let server;
beforeAll((done) => {
  server = http.createServer(app);
  server.listen(0, () => { // Use port 0 to get a random available port
    const port = server.address().port;
    process.env.TEST_SERVER_PORT = port;
    done();
  });
});

afterAll((done) => {
  if (server) {
    server.close(done);
  } else {
    done();
  }
});

// Helper function to get the test server URL
const getTestServerUrl = () => `http://localhost:${process.env.TEST_SERVER_PORT}`;

// Firebase Admin SDK is now mocked at the top of the file

// Mock user data
const mockUser = {
  uid: 'testuser123',
  email: 'test@example.com',
  emailVerified: true,
  customClaims: { role: 'user' }
};

const mockAdminUser = {
  uid: 'admin123',
  email: 'admin@example.com',
  emailVerified: true,
  customClaims: { role: 'admin' }
};

// Mock token
const mockToken = 'mock-jwt-token';

// Setup mock implementations
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Setup default mock implementations
  mockAuth.getUserByEmail.mockImplementation((email) => {
    if (email === mockUser.email) return Promise.resolve(mockUser);
    if (email === mockAdminUser.email) return Promise.resolve(mockAdminUser);
    return Promise.reject(new Error('User not found'));
  });

  mockAuth.verifyIdToken.mockResolvedValue({
    uid: mockUser.uid,
    email: mockUser.email,
    role: mockUser.customClaims.role
  });

  mockAuth.createUser.mockResolvedValue({
    uid: 'newuser123',
    email: 'newuser@example.com',
    emailVerified: false
  });

  // Mock Firestore
  db.collection('users').doc.mockReturnValue({
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Test User',
        email: mockUser.email,
        role: 'user'
      })
    }),
    set: jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue()
  });
});

// Test user data
const testUser = {
  email: 'test@example.com',
  password: 'test1234',
  name: 'Test User',
  phone: '1234567890'
};

// Test admin user data
const adminUser = {
  email: 'admin@example.com',
  password: 'admin1234',
  name: 'Admin User',
  phone: '0987654321',
  role: 'admin'
};

describe('Authentication API Integration Tests', () => {
  let mongoServer;
  let testUserId;
  let adminUserId;
  let testUserToken;
  let adminUserToken;

  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Clean up any existing test users
    try {
      // Try to delete test users if they exist
      const testUserRecord = await auth.getUserByEmail(testUser.email).catch(() => null);
      if (testUserRecord) await auth.deleteUser(testUserRecord.uid);
      
      const adminUserRecord = await auth.getUserByEmail(adminUser.email).catch(() => null);
      if (adminUserRecord) await auth.deleteUser(adminUserRecord.uid);
    } catch (error) {
      console.error('Error cleaning up test users:', error);
    }

    // Create test users in Firebase Auth
    try {
      // Create test user
      const testUserRecord = await auth.createUser({
        email: testUser.email,
        password: testUser.password,
        displayName: testUser.name,
        phoneNumber: testUser.phone
      });
      testUserId = testUserRecord.uid;

      // Create admin user
      const adminUserRecord = await auth.createUser({
        email: adminUser.email,
        password: adminUser.password,
        displayName: adminUser.name,
        phoneNumber: adminUser.phone
      });
      adminUserId = adminUserRecord.uid;

      // Set admin role
      await auth.setCustomUserClaims(adminUserId, { role: 'admin' });

      // Get ID tokens for testing
      testUserToken = await auth.createCustomToken(testUserId);
      adminUserToken = await auth.createCustomToken(adminUserId);
    } catch (error) {
      console.error('Error setting up test users:', error);
    }
  });

  afterAll(async () => {
    // Clean up test users
    try {
      await auth.deleteUser(testUserId);
      await auth.deleteUser(adminUserId);
    } catch (error) {
      console.error('Error cleaning up test users:', error);
    }
    
    // Disconnect from the in-memory database
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const newUser = {
        name: 'New User',
        email: 'new@example.com',
        password: '123456',
        role: 'user',
        phone: '5551234567'
      };

      // Mock the createUser response
      mockAuth.createUser.mockResolvedValueOnce({
        uid: 'newuser123',
        email: newUser.email,
        emailVerified: false
      });

      // Mock the Firestore set response
      const setMock = jest.fn().mockResolvedValue();
      db.collection('users').doc.mockReturnValueOnce({ set: setMock });

      const res = await request(getTestServerUrl())
        .post('/api/v1/auth/register')
        .send(newUser);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', newUser.email);
      
      // Verify Firestore was called correctly
      expect(setMock).toHaveBeenCalledWith({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        createdAt: expect.any(Date)
      });
    });

    it('should not register with existing email', async () => {
      // Mock getUserByEmail to return a user (simulating existing user)
      mockAuth.getUserByEmail.mockResolvedValueOnce({
        uid: 'existinguser123',
        email: testUser.email
      });

      const res = await request(getTestServerUrl())
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: '123456',
          name: 'Test User',
          role: 'user'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message', 'User already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Mock the Firebase sign-in
      mockAuth.verifyIdToken.mockResolvedValueOnce({
        uid: mockUser.uid,
        email: mockUser.email,
        role: 'user'
      });

      // Mock Firestore user data
      db.collection('users').doc(mockUser.uid).get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: 'Test User',
          email: mockUser.email,
          role: 'user'
        })
      });

      const res = await request(getTestServerUrl())
        .post('/api/v1/auth/login')
        .send({
          email: mockUser.email,
          password: 'test123' // Password is not actually checked in this mock
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', mockUser.email);
    });

    it('should not login with invalid credentials', async () => {
      // Mock failed login (user not found)
      mockAuth.getUserByEmail.mockRejectedValueOnce(new Error('User not found'));

      const res = await request(getTestServerUrl())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message', 'Invalid credentials');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should get current user profile with valid token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const token = loginRes.body.token;
      
      const res = await request(getTestServerUrl())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('email', testUser.email);
    });

    it('should not get profile without token', async () => {
      const res = await request(getTestServerUrl())
        .get('/api/v1/auth/me');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/v1/auth/updatedetails', () => {
    it('should update user details with valid token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const token = loginRes.body.token;
      const updatedName = 'Updated Test User';
      
      const res = await request(getTestServerUrl())
        .put('/api/v1/auth/updatedetails')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: updatedName });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('name', updatedName);
    });
  });

  describe('Admin Endpoints', () => {
    it('should update user role (admin only)', async () => {
      // Login as admin
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: adminUser.email,
          password: adminUser.password
        });

      const adminToken = loginRes.body.token;
      
      // Update test user's role
      const res = await request(getTestServerUrl())
        .put(`/api/v1/auth/updaterole/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'manager' });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('role', 'manager');
    });

    it('should not allow non-admin to update roles', async () => {
      // Login as regular user
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const userToken = loginRes.body.token;
      
      // Try to update role (should fail)
      const res = await request(getTestServerUrl())
        .put(`/api/v1/auth/updaterole/${adminUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'user' });

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('success', false);
    });
  });
});
