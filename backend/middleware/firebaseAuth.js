const { auth } = require('../config/firebase');

// Middleware to verify Firebase ID token
const firebaseAuth = async (req, res, next) => {
  try {
    // Get the ID token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No token provided'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Add the user info to the request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'user' // Default role is 'user' if not specified
    };
    
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired token'
    });
  }
};

// Middleware to check if user has admin role
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: 'Forbidden: Admin access required'
  });
};

module.exports = {
  firebaseAuth,
  isAdmin
};
