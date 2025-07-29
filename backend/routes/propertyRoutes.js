const express = require('express');
const router = express.Router();
const {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  propertyPhotoUpload,
  getPropertiesInRadius,
  getPropertiesByUser,
  getFeaturedProperties,
  getPropertyStats,
  getPropertiesByType,
  getPropertiesByAmenities,
  searchProperties
} = require('../controllers/propertyController');

const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', getProperties);
router.get('/:id', getProperty);
router.get('/radius/:zipcode/:distance', getPropertiesInRadius);
router.get('/user/:userId', getPropertiesByUser);
router.get('/featured', getFeaturedProperties);
router.get('/stats', getPropertyStats);
router.get('/type/:type', getPropertiesByType);
router.get('/amenities', getPropertiesByAmenities);
router.get('/search', searchProperties);

// Protected routes (require authentication and authorization)
router.use(protect);
router.post('/', authorize('admin', 'owner'), createProperty);
router.put('/:id', authorize('admin', 'owner'), updateProperty);
router.delete('/:id', authorize('admin', 'owner'), deleteProperty);
router.put('/:id/photo', authorize('admin', 'owner'), propertyPhotoUpload);

module.exports = router;
