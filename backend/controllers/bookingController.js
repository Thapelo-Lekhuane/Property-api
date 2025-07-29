const Booking = require('../models/Booking');
const Property = require('../models/Property');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// @desc    Get all bookings
// @route   GET /api/v1/bookings
// @route   GET /api/v1/properties/:propertyId/bookings
// @access  Private
exports.getBookings = asyncHandler(async (req, res, next) => {
  if (req.params.propertyId) {
    const bookings = await Booking.find({ property: req.params.propertyId })
      .populate({
        path: 'user',
        select: 'name email phone'
      })
      .populate({
        path: 'property',
        select: 'title price address'
      });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } else {
    res.status(200).json(res.advancedResults);
  }
});

// @desc    Get single booking
// @route   GET /api/v1/bookings/:id
// @access  Private
exports.getBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id)
    .populate({
      path: 'user',
      select: 'name email phone'
    })
    .populate({
      path: 'property',
      select: 'title price address images features'
    });

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is booking owner, property owner, or admin
  if (
    booking.user._id.toString() !== req.user.id &&
    booking.property.createdBy.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to view this booking`,
        401
      )
    );
  }

  res.status(200).json({
    success: true,
    data: booking
  });
});

// @desc    Create new booking
// @route   POST /api/v1/properties/:propertyId/bookings
// @access  Private
exports.createBooking = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.user = req.user.id;
  req.body.property = req.params.propertyId;

  const property = await Property.findById(req.params.propertyId);

  if (!property) {
    return next(
      new ErrorResponse(
        `Property not found with id of ${req.params.propertyId}`,
        404
      )
    );
  }

  // Check if property is available for the requested dates
  const isAvailable = await property.isAvailableForDates(
    new Date(req.body.startDate),
    new Date(req.body.endDate)
  );

  if (!isAvailable) {
    return next(
      new ErrorResponse('Property is not available for the selected dates', 400)
    );
  }

  // Calculate number of nights
  const startDate = new Date(req.body.startDate);
  const endDate = new Date(req.body.endDate);
  const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  // Calculate total price
  req.body.totalPrice = property.price * nights;

  const booking = await Booking.create(req.body);

  res.status(201).json({
    success: true,
    data: booking
  });
});

// @desc    Update booking
// @route   PUT /api/v1/bookings/:id
// @access  Private
exports.updateBooking = asyncHandler(async (req, res, next) => {
  let booking = await Booking.findById(req.params.id).populate('property');

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is booking owner, property owner, or admin
  if (
    booking.user.toString() !== req.user.id &&
    booking.property.createdBy.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this booking`,
        401
      )
    );
  }

  // If updating dates, check availability
  if (req.body.startDate || req.body.endDate) {
    const startDate = new Date(req.body.startDate || booking.startDate);
    const endDate = new Date(req.body.endDate || booking.endDate);

    const isAvailable = await Booking.isDateRangeAvailable(
      booking.property._id,
      startDate,
      endDate,
      booking._id
    );

    if (!isAvailable) {
      return next(
        new ErrorResponse('Property is not available for the selected dates', 400)
      );
    }

    // Recalculate total price if dates changed
    if (req.body.startDate || req.body.endDate) {
      const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      req.body.totalPrice = booking.property.price * nights;
    }
  }

  // Update booking
  booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: booking
  });
});

// @desc    Delete booking
// @route   DELETE /api/v1/bookings/:id
// @access  Private
exports.deleteBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is booking owner, property owner, or admin
  if (
    booking.user.toString() !== req.user.id &&
    booking.property.createdBy.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this booking`,
        401
      )
    );
  }

  await booking.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Upload payment proof
// @route   PUT /api/v1/bookings/:id/payment-proof
// @access  Private
exports.uploadPaymentProof = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is booking owner or admin
  if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this booking`,
        401
      )
    );
  }

  if (!req.files) {
    return next(new ErrorResponse(`Please upload a file`, 400));
  }

  const file = req.files.file;

  // Make sure the file is an image
  if (!file.mimetype.startsWith('image')) {
    return next(new ErrorResponse(`Please upload an image file`, 400));
  }

  // Check filesize
  const maxSize = 1000000; // 1MB
  if (file.size > maxSize) {
    return next(
      new ErrorResponse(`Please upload an image less than ${maxSize / 1000}KB`, 400)
    );
  }

  // Upload to Cloudinary
  try {
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: 'cyc-acres/payments',
      public_id: `payment_${booking._id}_${Date.now()}`,
      resource_type: 'image'
    });

    // Add payment proof to booking
    booking.paymentProof = {
      url: result.secure_url,
      publicId: result.public_id,
      verified: req.user.role === 'admin',
      verifiedAt: req.user.role === 'admin' ? Date.now() : null,
      verifiedBy: req.user.role === 'admin' ? req.user.id : undefined
    };

    // Update payment status
    if (req.user.role === 'admin') {
      booking.paymentStatus = 'paid';
    } else {
      booking.paymentStatus = 'pending';
    }

    await booking.save();

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error(err);
    return next(new ErrorResponse(`Problem with file upload`, 500));
  }
});

// @desc    Verify payment
// @route   PUT /api/v1/bookings/:id/verify-payment
// @access  Private (Admin)
exports.verifyPayment = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404)
    );
  }

  if (!booking.paymentProof) {
    return next(new ErrorResponse('No payment proof found for this booking', 400));
  }

  // Update payment verification
  booking.paymentProof.verified = true;
  booking.paymentProof.verifiedAt = Date.now();
  booking.paymentProof.verifiedBy = req.user.id;
  booking.paymentStatus = 'paid';

  // If this is the first payment, confirm the booking
  if (booking.status === 'pending') {
    booking.status = 'confirmed';
  }

  await booking.save();

  res.status(200).json({
    success: true,
    data: booking
  });
});

// @desc    Cancel booking
// @route   PUT /api/v1/bookings/:id/cancel
// @access  Private
exports.cancelBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id).populate('property');

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is booking owner, property owner, or admin
  if (
    booking.user.toString() !== req.user.id &&
    booking.property.createdBy.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to cancel this booking`,
        401
      )
    );
  }

  // Check if booking can be cancelled
  const now = new Date();
  const checkInDate = new Date(booking.startDate);
  const daysUntilCheckIn = Math.ceil((checkInDate - now) / (1000 * 60 * 60 * 24));

  // Only allow cancellation if check-in is more than 48 hours away
  if (daysUntilCheckIn < 2 && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        'Bookings can only be cancelled up to 48 hours before check-in',
        400
      )
    );
  }

  // Cancel the booking
  await booking.cancel(req.user.id, req.body.reason || 'Cancelled by user');

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Check in
// @route   PUT /api/v1/bookings/:id/checkin
// @access  Private (Admin)
exports.checkIn = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404)
    );
  }

  // Only allow check-in for confirmed bookings
  if (booking.status !== 'confirmed') {
    return next(
      new ErrorResponse(
        `Cannot check in a booking with status '${booking.status}'`,
        400
      )
    );
  }

  // Update check-in time
  booking.checkIn = new Date();
  booking.status = 'checked_in';

  await booking.save();

  res.status(200).json({
    success: true,
    data: booking
  });
});

// @desc    Check out
// @route   PUT /api/v1/bookings/:id/checkout
// @access  Private (Admin)
exports.checkOut = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404)
    );
  }

  // Only allow check-out for checked-in bookings
  if (booking.status !== 'checked_in') {
    return next(
      new ErrorResponse(
        `Cannot check out a booking with status '${booking.status}'`,
        400
      )
    );
  }

  // Update check-out time and mark as completed
  booking.checkOut = new Date();
  booking.status = 'completed';

  await booking.save();

  res.status(200).json({
    success: true,
    data: booking
  });
});
