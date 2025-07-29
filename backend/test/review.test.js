const request = require('supertest');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Property = require('../models/Property');
const User = require('../models/User');
const Booking = require('../models/Booking');
const app = require('../app');

// Test suite for Review API
describe('Review API', () => {
  let adminToken;
  let userToken;
  let testProperty;
  let testUser;
  let testAdmin;
  let testBooking;
  let testReview;

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
    testAdmin = await User.findOne({ email: 'admin@test.com' });

    // Get regular user token
    const userRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@test.com',
        password: 'password123'
      });
    userToken = userRes.body.token;
    testUser = await User.findOne({ email: 'test@test.com' });

    // Create a test property
    testProperty = await Property.create({
      title: 'Review Test Property',
      description: 'A property for testing reviews',
      price: 200,
      address: {
        street: '123 Review St',
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
        availableFrom: new Date('2025-01-01')
      },
      createdBy: testAdmin._id,
      isAvailable: true
    });

    // Create a completed booking for the test user
    testBooking = await Booking.create({
      property: testProperty._id,
      user: testUser._id,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-07'),
      checkIn: new Date('2025-01-01'),
      checkOut: new Date('2025-01-07'),
      guests: 2,
      totalPrice: 1200,
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'credit_card'
    });

    // Create a test review
    testReview = await Review.create({
      property: testProperty._id,
      user: testUser._id,
      rating: 5,
      comment: 'Great property, had a wonderful stay!',
      booking: testBooking._id
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    await Review.deleteMany({});
    await Booking.deleteMany({});
    await Property.deleteMany({});
  });

  // Test get all reviews
  describe('GET /api/v1/reviews', () => {
    it('should get all reviews', async () => {
      const res = await request(app)
        .get('/api/v1/reviews')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBeTruthy();
    });

    it('should filter reviews by property', async () => {
      const res = await request(app)
        .get(`/api/v1/properties/${testProperty._id}/reviews`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBeTruthy();
      
      // All returned reviews should be for the specified property
      if (res.body.data.length > 0) {
        res.body.data.forEach(review => {
          expect(review.property).toHaveProperty('_id', testProperty._id.toString());
        });
      }
    });
  });

  // Test get single review
  describe('GET /api/v1/reviews/:id', () => {
    it('should get a single review by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('_id', testReview._id.toString());
      expect(res.body.data).toHaveProperty('property');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('rating', 5);
    });

    it('should return 404 for non-existent review', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/v1/reviews/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test add review
  describe('POST /api/v1/properties/:propertyId/reviews', () => {
    let newProperty;
    let newBooking;

    beforeAll(async () => {
      // Create a new property and booking for testing review creation
      newProperty = await Property.create({
        title: 'New Review Test Property',
        description: 'Another property for testing reviews',
        price: 250,
        address: {
          street: '456 Review Ave',
          city: 'Test City',
          province: 'Gauteng',
          postalCode: '0001',
          country: 'South Africa'
        },
        features: {
          bedrooms: 3,
          bathrooms: 2,
          parking: true,
          furnished: true,
          availableFrom: new Date('2025-01-01')
        },
        createdBy: testAdmin._id,
        isAvailable: true
      });

      // Create a completed booking for the test user
      newBooking = await Booking.create({
        property: newProperty._id,
        user: testUser._id,
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-07'),
        checkIn: new Date('2025-02-01'),
        checkOut: new Date('2025-02-07'),
        guests: 2,
        totalPrice: 1500,
        status: 'completed',
        paymentStatus: 'paid',
        paymentMethod: 'credit_card'
      });
    });

    afterAll(async () => {
      // Clean up
      await Booking.findByIdAndDelete(newBooking._id);
      await Property.findByIdAndDelete(newProperty._id);
    });

    it('should add a new review', async () => {
      const reviewData = {
        rating: 4,
        comment: 'Great stay, would recommend!',
        booking: newBooking._id
      };

      const res = await request(app)
        .post(`/api/v1/properties/${newProperty._id}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(reviewData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('property', newProperty._id.toString());
      expect(res.body.data).toHaveProperty('user', testUser._id.toString());
      expect(res.body.data).toHaveProperty('rating', reviewData.rating);
      expect(res.body.data).toHaveProperty('comment', reviewData.comment);

      // Clean up
      await Review.findByIdAndDelete(res.body.data._id);
    });

    it('should not allow duplicate reviews for same booking', async () => {
      const reviewData = {
        rating: 4,
        comment: 'Great stay, would recommend!',
        booking: newBooking._id
      };

      // First review (should succeed)
      await request(app)
        .post(`/api/v1/properties/${newProperty._id}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(reviewData);

      // Second review for same booking (should fail)
      const res = await request(app)
        .post(`/api/v1/properties/${newProperty._id}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ...reviewData,
          rating: 5 // Different rating, but same booking
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);

      // Clean up
      await Review.deleteMany({ booking: newBooking._id });
    });
  });

  // Test update review
  describe('PUT /api/v1/reviews/:id', () => {
    let review;

    beforeEach(async () => {
      // Create a review for testing updates
      review = await Review.create({
        property: testProperty._id,
        user: testUser._id,
        booking: testBooking._id,
        rating: 3,
        comment: 'It was okay.'
      });
    });

    afterEach(async () => {
      // Clean up
      await Review.findByIdAndDelete(review._id);
    });

    it('should update a review (owner)', async () => {
      const updates = {
        rating: 4,
        comment: 'Actually, it was quite good!'
      };

      const res = await request(app)
        .put(`/api/v1/reviews/${review._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updates);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('rating', updates.rating);
      expect(res.body.data).toHaveProperty('comment', updates.comment);
    });

    it('should not allow updating review with invalid rating', async () => {
      const res = await request(app)
        .put(`/api/v1/reviews/${review._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 6, // Invalid rating (should be 1-5)
          comment: 'This should fail.'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test delete review
  describe('DELETE /api/v1/reviews/:id', () => {
    let review;

    beforeEach(async () => {
      // Create a review for testing deletion
      review = await Review.create({
        property: testProperty._id,
        user: testUser._id,
        booking: testBooking._id,
        rating: 3,
        comment: 'Will be deleted soon.'
      });
    });

    it('should delete a review (owner)', async () => {
      const res = await request(app)
        .delete(`/api/v1/reviews/${review._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toEqual({});

      // Verify review was deleted
      const deletedReview = await Review.findById(review._id);
      expect(deletedReview).toBeNull();
    });

    it('should not allow non-owner to delete review', async () => {
      // Create another user
      const anotherUser = await User.create({
        name: 'Another User',
        email: 'another@test.com',
        password: 'password123',
        role: 'user'
      });

      // Login as another user
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'another@test.com',
          password: 'password123'
        });
      
      const anotherUserToken = loginRes.body.token;

      // Try to delete the review
      const res = await request(app)
        .delete(`/api/v1/reviews/${review._id}`)
        .set('Authorization', `Bearer ${anotherUserToken}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);

      // Clean up
      await User.findByIdAndDelete(anotherUser._id);
    });
  });

  // Test review replies
  describe('Review Replies', () => {
    let review;

    beforeEach(async () => {
      // Create a review for testing replies
      review = await Review.create({
        property: testProperty._id,
        user: testUser._id,
        booking: testBooking._id,
        rating: 4,
        comment: 'Great place!'
      });
    });

    afterEach(async () => {
      // Clean up
      await Review.findByIdAndDelete(review._id);
    });

    it('should add a reply to a review (admin)', async () => {
      const reply = 'Thank you for your feedback!';
      
      const res = await request(app)
        .put(`/api/v1/reviews/${review._id}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reply });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('reply');
      expect(res.body.data.reply).toHaveProperty('text', reply);
      expect(res.body.data.reply).toHaveProperty('user');
      expect(res.body.data.reply.user).toHaveProperty('_id', testAdmin._id.toString());
    });

    it('should not allow non-admin to add a reply', async () => {
      const reply = 'This should fail';
      
      const res = await request(app)
        .put(`/api/v1/reviews/${review._id}/reply`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reply });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });
});
