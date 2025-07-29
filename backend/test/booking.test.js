const request = require('supertest');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const User = require('../models/User');
const app = require('../app');

// Test suite for Booking API
describe('Booking API', () => {
  let adminToken;
  let userToken;
  let testProperty;
  let testBooking;
  let testUser;
  let testAdmin;

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
      title: 'Booking Test Property',
      description: 'A property for testing bookings',
      price: 200,
      address: {
        street: '123 Booking St',
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
        availableFrom: new Date('2025-01-01'),
        availableTo: new Date('2025-12-31')
      },
      createdBy: testAdmin._id,
      isAvailable: true
    });

    // Create a test booking
    testBooking = await Booking.create({
      property: testProperty._id,
      user: testUser._id,
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-07'),
      guests: 2,
      totalPrice: 1200,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'credit_card'
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    await Booking.deleteMany({});
    await Property.deleteMany({});
  });

  // Test get all bookings
  describe('GET /api/v1/bookings', () => {
    it('should get all bookings (admin)', async () => {
      const res = await request
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBeTruthy();
    });

    it('should only get user\'s own bookings (non-admin)', async () => {
      const res = await request
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBeTruthy();
      
      // Verify all returned bookings belong to the user
      if (res.body.data.length > 0) {
        res.body.data.forEach(booking => {
          expect(booking.user).toHaveProperty('_id', testUser._id.toString());
        });
      }
    });
  });

  // Test get single booking
  describe('GET /api/v1/bookings/:id', () => {
    it('should get a single booking by ID (owner)', async () => {
      const res = await request
        .get(`/api/v1/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('_id', testBooking._id.toString());
      expect(res.body.data).toHaveProperty('property');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.status).toEqual('confirmed');
    });

    it('should not get booking that does not belong to user', async () => {
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

      // Try to access the test booking
      const res = await request
        .get(`/api/v1/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${anotherUserToken}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);

      // Clean up
      await User.findByIdAndDelete(anotherUser._id);
    });
  });

  // Test create booking
  describe('POST /api/v1/properties/:propertyId/bookings', () => {
    it('should create a new booking', async () => {
      const bookingData = {
        startDate: '2025-07-01',
        endDate: '2025-07-07',
        guests: 2,
        paymentMethod: 'credit_card'
      };

      const res = await request
        .post(`/api/v1/properties/${testProperty._id}/bookings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('property', testProperty._id.toString());
      expect(res.body.data).toHaveProperty('user', testUser._id.toString());
      expect(res.body.data).toHaveProperty('status', 'pending');
      expect(res.body.data).toHaveProperty('paymentStatus', 'pending');
      expect(res.body.data).toHaveProperty('totalPrice', 1200); // 200 * 6 nights

      // Clean up
      await Booking.findByIdAndDelete(res.body.data._id);
    });

    it('should not allow booking for unavailable dates', async () => {
      const bookingData = {
        startDate: '2025-06-05', // Overlaps with test booking
        endDate: '2025-06-10',
        guests: 2,
        paymentMethod: 'credit_card'
      };

      const res = await request
        .post(`/api/v1/properties/${testProperty._id}/bookings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test update booking
  describe('PUT /api/v1/bookings/:id', () => {
    let booking;

    beforeEach(async () => {
      // Create a booking for testing updates
      booking = await Booking.create({
        property: testProperty._id,
        user: testUser._id,
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-08-07'),
        guests: 2,
        totalPrice: 1200,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: 'credit_card'
      });
    });

    afterEach(async () => {
      // Clean up
      await Booking.findByIdAndDelete(booking._id);
    });

    it('should update a booking (owner)', async () => {
      const updates = {
        guests: 3,
        specialRequests: 'Please provide extra towels.'
      };

      const res = await request
        .put(`/api/v1/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updates);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('guests', updates.guests);
      expect(res.body.data).toHaveProperty('specialRequests', updates.specialRequests);
    });

    it('should not allow updating to unavailable dates', async () => {
      const updates = {
        startDate: '2025-06-05', // Overlaps with test booking
        endDate: '2025-06-10'
      };

      const res = await request
        .put(`/api/v1/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updates);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test cancel booking
  describe('PUT /api/v1/bookings/:id/cancel', () => {
    let booking;

    beforeEach(async () => {
      // Create a booking for testing cancellation
      booking = await Booking.create({
        property: testProperty._id,
        user: testUser._id,
        startDate: new Date('2025-09-01'),
        endDate: new Date('2025-09-07'),
        guests: 2,
        totalPrice: 1200,
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: 'credit_card'
      });
    });

    afterEach(async () => {
      // Clean up
      await Booking.findByIdAndDelete(booking._id);
    });

    it('should cancel a booking (owner)', async () => {
      const res = await request
        .put(`/api/v1/bookings/${booking._id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'Change of plans'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);

      // Verify booking was cancelled
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking.status).toEqual('cancelled');
      expect(updatedBooking.cancellationReason).toEqual('Change of plans');
    });
  });

  // Test upload payment proof
  describe('PUT /api/v1/bookings/:id/payment-proof', () => {
    let booking;

    beforeEach(async () => {
      // Create a booking for testing payment proof upload
      booking = await Booking.create({
        property: testProperty._id,
        user: testUser._id,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-10-07'),
        guests: 2,
        totalPrice: 1200,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: 'eft'
      });
    });

    afterEach(async () => {
      // Clean up
      await Booking.findByIdAndDelete(booking._id);
    });

    it('should upload payment proof', async () => {
      // Mock file upload
      const res = await request
        .put(`/api/v1/bookings/${booking._id}/payment-proof`)
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', 'test/fixtures/test-receipt.jpg');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('paymentProof');
      expect(res.body.data.paymentProof).toHaveProperty('url');
      expect(res.body.data.paymentProof.verified).toBe(false);
      expect(res.body.data.paymentStatus).toBe('pending');
    });
  });

  // Test verify payment
  describe('PUT /api/v1/bookings/:id/verify-payment', () => {
    let booking;

    beforeEach(async () => {
      // Create a booking with payment proof for testing verification
      booking = await Booking.create({
        property: testProperty._id,
        user: testUser._id,
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-11-07'),
        guests: 2,
        totalPrice: 1200,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: 'eft',
        paymentProof: {
          url: 'https://example.com/payment-proof.jpg',
          publicId: 'payment_proof_123',
          verified: false
        }
      });
    });

    afterEach(async () => {
      // Clean up
      await Booking.findByIdAndDelete(booking._id);
    });

    it('should verify payment (admin)', async () => {
      const res = await request
        .put(`/api/v1/bookings/${booking._id}/verify-payment`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('paymentProof.verified', true);
      expect(res.body.data).toHaveProperty('paymentStatus', 'paid');
      expect(res.body.data).toHaveProperty('status', 'confirmed');
    });

    it('should not allow non-admin to verify payment', async () => {
      const res = await request
        .put(`/api/v1/bookings/${booking._id}/verify-payment`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test check-in and check-out
  describe('Check-in/Check-out', () => {
    let booking;

    beforeEach(async () => {
      // Create a confirmed booking for testing check-in/check-out
      booking = await Booking.create({
        property: testProperty._id,
        user: testUser._id,
        startDate: new Date('2025-12-01'),
        endDate: new Date('2025-12-07'),
        guests: 2,
        totalPrice: 1200,
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: 'credit_card'
      });
    });

    afterEach(async () => {
      // Clean up
      await Booking.findByIdAndDelete(booking._id);
    });

    it('should check in a booking (admin)', async () => {
      const res = await request
        .put(`/api/v1/bookings/${booking._id}/checkin`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('status', 'checked_in');
      expect(res.body.data.checkIn).toBeDefined();
    });

    it('should check out a booking (admin)', async () => {
      // First check in
      await Booking.findByIdAndUpdate(booking._id, { 
        status: 'checked_in',
        checkIn: new Date()
      });

      const res = await request
        .put(`/api/v1/bookings/${booking._id}/checkout`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('status', 'completed');
      expect(res.body.data.checkOut).toBeDefined();
    });
  });
});
