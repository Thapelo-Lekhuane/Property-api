const { auth, db } = require('../config/firebase');
const { firebaseAuth, isAdmin } = require('../middleware/firebaseAuth');

// @desc    Get current user profile
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const userRecord = await auth.getUser(req.user.uid);
    
    // Get additional user data from Firestore if needed
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    res.status(200).json({
      success: true,
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        ...userData
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user details
// @route   PUT /api/v1/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    
    // Update user data in Firestore
    await db.collection('users').doc(req.user.uid).set(
      { name, phone, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    
    res.status(200).json({
      success: true,
      data: { name, phone }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role (admin only)
// @route   PUT /api/v1/auth/updaterole/:id
// @access  Private/Admin
exports.updateRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const { id } = req.params;
    
    // Update custom claims for role-based access
    await auth.setCustomUserClaims(id, { role });
    
    // Update role in Firestore
    await db.collection('users').doc(id).set(
      { role, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    
    res.status(200).json({
      success: true,
      data: { role }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/v1/auth/deleteuser
// @access  Private
exports.deleteUser = async (req, res, next) => {
  try {
    await auth.deleteUser(req.user.uid);
    await db.collection('users').doc(req.user.uid).delete();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
