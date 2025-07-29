const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Simple test to verify Jest and MongoDB Memory Server are working
describe('Minimal Test Setup', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should connect to the in-memory database', () => {
    // 1 means connected
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('should perform a simple database operation', async () => {
    // Create a test collection and insert a document
    const testCollection = mongoose.connection.db.collection('test');
    await testCollection.insertOne({ test: 'value' });
    
    // Verify the document was inserted
    const result = await testCollection.findOne({ test: 'value' });
    expect(result).toBeTruthy();
    expect(result.test).toBe('value');
  });
});
