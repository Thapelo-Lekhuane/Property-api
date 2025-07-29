const express = require('express');
const router = express.Router();
const {
  getBookings,
  getBooking,
  addBooking,
  updateBooking,
  deleteBooking,
  getBookingsByUser,
  getBookingsByProperty,
  getBookingsByDateRange,
  uploadPaymentProof,
  verifyPayment,
  checkIn,
  checkOut,
  cancelBooking,
  getBookingStats
} = require('../controllers/bookingController');

const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/stats', getBookingStats);

// Protected routes (require authentication)
router.use(protect);
router.get('/', getBookings);
router.get('/:id', getBooking);
router.get('/user/:userId', getBookingsByUser);
router.get('/property/:propertyId', getBookingsByProperty);
router.get('/availability/date-range', getBookingsByDateRange);

// Protected routes for booking management
router.post('/', authorize('user', 'admin'), addBooking);
router.put('/:id', authorize('user', 'admin'), updateBooking);
router.delete('/:id', authorize('user', 'admin'), deleteBooking);
router.put('/:id/payment-proof', authorize('user', 'admin'), uploadPaymentProof);
router.put('/:id/verify-payment', authorize('admin'), verifyPayment);
router.put('/:id/check-in', authorize('admin'), checkIn);
router.put('/:id/check-out', authorize('admin'), checkOut);
router.put('/:id/cancel', authorize('user', 'admin'), cancelBooking);

module.exports = router;
