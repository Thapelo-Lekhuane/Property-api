const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createServer } = require('http');
const express = require('express');
const { Server } = require('socket.io');
const app = require('../app');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const request = require('supertest');

let mongoServer;
let server;
let io;
let testApp;

// Mock Cloudinary upload
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn().mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        public_id: 'test_public_id'
      }),
      destroy: jest.fn().mockResolvedValue({ result: 'ok' })
    }
  }
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true)
  })
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test_token'),
  verify: jest.fn().mockReturnValue({ id: 'test_user_id' })
}));

beforeAll(async () => {
  try {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Create a new Express app for testing
    testApp = express();
    testApp.use(express.json());
    
    // Initialize the main app with the test database
    await app.initialize();
    
    // Mount the app's router
    testApp.use('/api/v1', app.router);
    
    // Create HTTP server
    server = createServer(testApp);
    
    // Set up Socket.IO
    io = new Server(server);
    
    // Start server on a random port
    await new Promise((resolve) => {
      server.listen(0, 'localhost', resolve);
    });
    
    // Set base URL for tests
    global.baseUrl = `http://localhost:${server.address().port}/api/v1`;
    
    // Create a test request instance
    global.request = request(testApp);
    
    // Set up test data
    await setupTestData();
  } catch (error) {
    console.error('Test setup error:', error);
    throw error;
  }
});

// Set up test data
async function setupTestData() {
  // Create test users
  const adminUser = await User.create({
    name: 'Admin User',
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin',
    isVerified: true
  });

  const testUser = await User.create({
    name: 'Test User',
    email: 'test@test.com',
    password: 'password123',
    role: 'user',
    isVerified: true
  });

  // Create test property
  const testProperty = await Property.create({
    title: 'Test Property',
    description: 'A beautiful test property',
    price: 100,
    address: {
      street: '123 Test St',
      city: 'Test City',
      province: 'Gauteng',
      postalCode: '0001',
      country: 'South Africa'
    },
    features: {
      bedrooms: 2,
      bathrooms: 1,
      parking: true,
      furnished: true,
      availableFrom: new Date('2025-08-01')
    },
    createdBy: adminUser._id,
    isAvailable: true
  });

  // Create test booking
  await Booking.create({
    property: testProperty._id,
    user: testUser._id,
    startDate: new Date('2025-08-15'),
    endDate: new Date('2025-08-20'),
    guests: 2,
    totalPrice: 500,
    status: 'confirmed',
    paymentStatus: 'paid',
    paymentMethod: 'credit_card'
  });
}

afterAll(async () => {
  // Close server and database connection
  await mongoose.disconnect();
  await mongoServer.stop();
  await new Promise((resolve) => server.close(resolve));
});

// Helper function to get auth token for testing
async function getAuthToken(email = 'test@test.com', password = 'password123') {
  const res = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return res.body.token;
};

// Helper function to get admin token
async function getAdminToken() {
  return getAuthToken('admin@test.com', 'password123');
};

// Export test utilities
global.getAuthToken = getAuthToken;
global.getAdminToken = getAdminToken;

// Import supertest after setting up global variables
const request = require('supertest');
global.request = request(app);
