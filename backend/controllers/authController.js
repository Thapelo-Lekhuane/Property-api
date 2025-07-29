const { auth, db } = require('../config/firebase');
const admin = require('firebase-admin');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { email, password, name, phone } = req.body;

  try {
    // Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone,
      emailVerified: false,
      disabled: false
    });

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      name,
      email,
      phone,
      role: 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send email verification
    const link = await auth.generateEmailVerificationLink(email);
    // TODO: Send verification email with the link

    res.status(201).json({
      success: true,
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return next(new ErrorResponse('Error registering user', 400));
  }
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Sign in with email and password using Firebase Admin SDK
    // Note: In a production app, this would be handled by the Firebase Client SDK
    // and only the ID token would be sent to the server for verification
    const userRecord = await auth.getUserByEmail(email);
    
    // In a real app, you would verify the password using Firebase Client SDK
    // and then verify the ID token on the server
    const token = await auth.createCustomToken(userRecord.uid);
    
    // Get additional user data from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    res.status(200).json({
      success: true,
      token,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName,
        ...userData
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return next(new ErrorResponse('Invalid credentials', 401));
  }
});

// @desc    Log user out
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  // In a real app, you would revoke the token on the client side
  // and handle the session there since Firebase handles sessions client-side
  
  res.status(200).json({
    success: true,
    data: { message: 'Logout successful' }
  });
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await db.collection('users').doc(req.user.uid).get();
  res.status(200).json({
    success: true,
    data: user.data()
  });
});

// @desc    Update user details
// @route   PUT /api/v1/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone
  };

  const user = await db.collection('users').doc(req.user.uid).update(fieldsToUpdate);

  res.status(200).json({
    success: true,
    data: fieldsToUpdate
  });
});

// @desc    Update password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // Get the user's current password
    const user = await auth.getUserByEmail(req.user.email);
    const password = user.password;

    // Check if the current password is correct
    if (!(await auth.verifyPassword(user.uid, currentPassword))) {
      return next(new ErrorResponse('Password is incorrect', 401));
    }

    // Update the user's password
    await auth.updateUser(user.uid, {
      password: newPassword
    });

    res.status(200).json({
      success: true,
      data: { message: 'Password updated successfully' }
    });
  } catch (error) {
    console.error('Password update error:', error);
    return next(new ErrorResponse('Error updating password', 400));
  }
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  
  try {
    // Generate password reset link
    const resetLink = await auth.generatePasswordResetLink(email, {
      url: `${process.env.FRONTEND_URL}/reset-password`
    });
    
    // TODO: Send email with reset link
    console.log('Password reset link:', resetLink);
    
    res.status(200).json({
      success: true,
      data: { message: 'Password reset email sent' }
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return next(new ErrorResponse('Error sending password reset email', 400));
  }
});

// @desc    Reset password
// @route   POST /api/v1/auth/resetpassword
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { oobCode, newPassword } = req.body;
  
  try {
    // Verify the password reset code is valid
    const email = await auth.verifyPasswordResetCode(oobCode);
    
    // Update the user's password
    await auth.confirmPasswordReset(oobCode, newPassword);
    
    res.status(200).json({
      success: true,
      data: { message: 'Password updated successfully' }
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return next(new ErrorResponse('Error resetting password', 400));
  }
});

// @desc    Verify email
// @route   GET /api/v1/auth/verify-email
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const { oobCode } = req.query;
  
  try {
    // Verify the email verification code
    const email = await auth.verifyPasswordResetCode(oobCode);
    
    // Mark the email as verified
    await auth.updateUser(auth.getUserByEmail(email).uid, {
      emailVerified: true
    });
    
    // Update user in Firestore
    await db.collection('users').doc(auth.getUserByEmail(email).uid).update({
      emailVerified: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Redirect to success page or return success response
    res.status(200).json({
      success: true,
      data: { message: 'Email verified successfully' }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return next(new ErrorResponse('Email verification failed', 400));
  }
});

// @desc    Test route
// @route   GET /api/v1/auth/test
// @access  Public
exports.testRoute = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Test route is working'
  });
});
