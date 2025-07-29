const express = require('express');
const router = express.Router();
const { firebaseAuth } = require('../middleware/firebaseAuth');
const {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updateRole,
  deleteUser
} = require('../controllers/userController');

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);

// Protected routes (require Firebase Authentication)
router.use(firebaseAuth);

// User profile routes
router.get('/me', getMe);
router.put('/updatedetails', updateDetails);
router.delete('/deleteuser', deleteUser);

// Admin routes
router.put('/updaterole/:id', updateRole);

// Logout is handled client-side with Firebase Auth
router.post('/logout', logout);
router.put('/updatepassword', updatePassword);

module.exports = router;
