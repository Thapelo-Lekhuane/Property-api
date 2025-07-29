const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const http = require('http');

let mongoServer;
let app;
let server;
let baseUrl;

/**
 * Initialize the test environment
 */
async function initTestEnvironment() {
  try {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Create a new Express app
    app = express();
    app.use(express.json());

    // Import and use only auth routes for simple test
    const authRoutes = require('../routes/authRoutes');
    app.use('/api/v1/auth', authRoutes);
    
    // Simple test route
    app.get('/api/v1/test', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Test route is working'
      });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ 
        success: false, 
        error: 'Internal Server Error' 
      });
    });

    // Create HTTP server
    server = http.createServer(app);
    
    // Start server on a random port
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    return { app, server, baseUrl };
  } catch (error) {
    console.error('Test environment setup error:', error);
    throw error;
  }
}

/**
 * Clean up test environment
 */
async function cleanupTestEnvironment() {
  try {
    // Close server if it exists
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    
    // Close database connections
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    
    // Stop MongoDB memory server
    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (error) {
    console.error('Test environment cleanup error:', error);
    throw error;
  }
}

/**
 * Get test server URL
 */
function getBaseUrl() {
  return baseUrl;
}

module.exports = {
  initTestEnvironment,
  cleanupTestEnvironment,
  getBaseUrl,
  app: () => app,
  server: () => server
};
