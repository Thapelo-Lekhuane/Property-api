const request = require('supertest');
const mongoose = require('mongoose');
const Property = require('../models/Property');
const User = require('../models/User');
const app = require('../app');

// Test suite for Property API
describe('Property API', () => {
  let adminToken;
  let userToken;
  let testProperty;
  let testUser;

  // Setup before all tests
  beforeAll(async () => {
    // Get admin token
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });
    adminToken = adminRes.body.token;

    // Get regular user token
    const userRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@test.com',
        password: 'password123'
      });
    userToken = userRes.body.token;

    // Get test user
    testUser = await User.findOne({ email: 'test@test.com' });
  });

  // Test get all properties
  describe('GET /api/v1/properties', () => {
    it('should get all properties', async () => {
      const res = await request
        .get('/api/v1/properties')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBeTruthy();
      
      // Save first property for later tests
      if (res.body.data.length > 0) {
        testProperty = res.body.data[0];
      }
    });

    it('should filter properties by city', async () => {
      const res = await request
        .get('/api/v1/properties?city=Test+City')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBeTruthy();
      
      // All returned properties should be in the specified city
      if (res.body.data.length > 0) {
        res.body.data.forEach(property => {
          expect(property.address.city).toMatch(/Test City/i);
        });
      }
    });
  });

  // Test get single property
  describe('GET /api/v1/properties/:id', () => {
    it('should get a single property by ID', async () => {
      if (!testProperty) {
        const properties = await Property.find();
        testProperty = properties[0];
      }

      const res = await request
        .get(`/api/v1/properties/${testProperty._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('_id', testProperty._id.toString());
      expect(res.body.data).toHaveProperty('title');
      expect(res.body.data).toHaveProperty('description');
      expect(res.body.data).toHaveProperty('price');
      expect(res.body.data).toHaveProperty('address');
    });

    it('should return 404 for non-existent property', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request
        .get(`/api/v1/properties/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test create property
  describe('POST /api/v1/properties', () => {
    const newProperty = {
      title: 'New Test Property',
      description: 'A brand new test property',
      price: 150,
      address: {
        street: '456 Test Ave',
        city: 'Test City',
        province: 'Gauteng',
        postalCode: '0001',
        country: 'South Africa'
      },
      features: {
        bedrooms: 3,
        bathrooms: 2,
        parking: true,
        furnished: false,
        availableFrom: '2025-09-01'
      },
      isAvailable: true
    };

    it('should create a new property (admin)', async () => {
      const res = await request
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newProperty);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('title', newProperty.title);
      expect(res.body.data).toHaveProperty('description', newProperty.description);
      expect(res.body.data).toHaveProperty('price', newProperty.price);
      
      // Save for later tests
      testProperty = res.body.data;
    });

    it('should not allow non-admin to create property', async () => {
      const res = await request
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newProperty);

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test update property
  describe('PUT /api/v1/properties/:id', () => {
    const updates = {
      title: 'Updated Test Property',
      price: 175,
      'features.bedrooms': 4
    };

    it('should update a property (admin)', async () => {
      if (!testProperty) {
        const properties = await Property.find();
        testProperty = properties[0];
      }

      const res = await request
        .put(`/api/v1/properties/${testProperty._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('title', updates.title);
      expect(res.body.data).toHaveProperty('price', updates.price);
      expect(res.body.data.features).toHaveProperty('bedrooms', updates['features.bedrooms']);
    });

    it('should not allow non-admin to update property', async () => {
      const res = await request
        .put(`/api/v1/properties/${testProperty._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updates);

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test delete property
  describe('DELETE /api/v1/properties/:id', () => {
    it('should not allow non-admin to delete property', async () => {
      const res = await request
        .delete(`/api/v1/properties/${testProperty._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should delete a property (admin)', async () => {
      const res = await request
        .delete(`/api/v1/properties/${testProperty._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toEqual({});

      // Verify property is deleted
      const deletedProperty = await Property.findById(testProperty._id);
      expect(deletedProperty).toBeNull();
    });
  });

  // Test property photo upload
  describe('PUT /api/v1/properties/:id/photo', () => {
    let property;

    beforeAll(async () => {
      // Create a test property for photo upload
      property = await Property.create({
        title: 'Photo Test Property',
        description: 'A property for testing photo uploads',
        price: 200,
        address: {
          street: '789 Photo St',
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
          availableFrom: new Date('2025-09-01')
        },
        createdBy: new mongoose.Types.ObjectId(),
        isAvailable: true
      });
    });

    it('should upload a photo for a property', async () => {
      // Mock file upload
      const res = await request
        .put(`/api/v1/properties/${property._id}/photo`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', 'test/fixtures/test-image.jpg');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBeTruthy();
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('url');
      expect(res.body.data[0]).toHaveProperty('isFeatured', true);
    });

    afterAll(async () => {
      // Clean up
      await Property.findByIdAndDelete(property._id);
    });
  });

  // Test property availability
  describe('GET /api/v1/properties/:id/availability', () => {
    let availableProperty;

    beforeAll(async () => {
      // Create a test property for availability check
      availableProperty = await Property.create({
        title: 'Available Test Property',
        description: 'A property for testing availability',
        price: 180,
        address: {
          street: '123 Available St',
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
          availableFrom: new Date('2025-09-01')
        },
        createdBy: new mongoose.Types.ObjectId(),
        isAvailable: true
      });
    });

    it('should check property availability', async () => {
      const res = await request
        .get(`/api/v1/properties/${availableProperty._id}/availability?startDate=2025-09-10&endDate=2025-09-15`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('available', true);
      expect(res.body.data.property).toHaveProperty('id', availableProperty._id.toString());
    });

    afterAll(async () => {
      // Clean up
      await Property.findByIdAndDelete(availableProperty._id);
    });
  });
});
