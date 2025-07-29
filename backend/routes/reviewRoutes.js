const express = require('express');
const router = express.Router();
const {
  getReviews,
  getReview,
  addReview,
  updateReview,
  deleteReview,
  getReviewsByProperty,
  getReviewsByUser,
  addReplyToReview,
  getReviewStats
} = require('../controllers/reviewController');

const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', getReviews);
router.get('/:id', getReview);
router.get('/property/:propertyId', getReviewsByProperty);
router.get('/user/:userId', protect, getReviewsByUser);
router.get('/stats/review-stats', getReviewStats);

// Protected routes (require authentication)
router.use(protect);
router.post('/', authorize('user', 'admin'), addReview);
router.put('/:id', authorize('user', 'admin'), updateReview);
router.delete('/:id', authorize('user', 'admin'), deleteReview);

// Admin routes for managing reviews
router.post('/:id/reply', authorize('admin'), addReplyToReview);

module.exports = router;
