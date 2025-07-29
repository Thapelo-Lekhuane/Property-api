const Review = require('../models/Review');
const Property = require('../models/Property');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get reviews
// @route   GET /api/v1/reviews
// @route   GET /api/v1/properties/:propertyId/reviews
// @access  Public
exports.getReviews = asyncHandler(async (req, res, next) => {
  if (req.params.propertyId) {
    const reviews = await Review.find({ property: req.params.propertyId })
      .populate({
        path: 'user',
        select: 'name'
      });

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } else {
    res.status(200).json(res.advancedResults);
  }
});

// @desc    Get single review
// @route   GET /api/v1/reviews/:id
// @access  Public
exports.getReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate({
    path: 'property',
    select: 'title'
  });

  if (!review) {
    return next(
      new ErrorResponse(`No review found with the id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Add review
// @route   POST /api/v1/properties/:propertyId/reviews
// @access  Private
exports.addReview = asyncHandler(async (req, res, next) => {
  // Add user and property to req.body
  req.body.user = req.user.id;
  req.body.property = req.params.propertyId;

  const property = await Property.findById(req.params.propertyId);

  if (!property) {
    return next(
      new ErrorResponse(
        `No property with the id of ${req.params.propertyId}`,
        404
      )
    );
  }

  // Check if user has a completed booking for this property
  const booking = await Booking.findOne({
    user: req.user.id,
    property: req.params.propertyId,
    status: 'completed',
    checkOut: { $lte: new Date() },
    checkIn: { $exists: true },
    checkOut: { $exists: true }
  });

  if (!booking && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to add a review for this property`,
        401
      )
    );
  }

  // Check if user already reviewed the property
  const existingReview = await Review.findOne({
    user: req.user.id,
    property: req.params.propertyId
  });

  if (existingReview) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} has already reviewed this property`,
        400
      )
    );
  }

  const review = await Review.create(req.body);

  // Recalculate average rating for the property
  await calculateAverageRating(review.property);

  res.status(201).json({
    success: true,
    data: review
  });
});

// @desc    Update review
// @route   PUT /api/v1/reviews/:id
// @access  Private
exports.updateReview = asyncHandler(async (req, res, next) => {
  let review = await Review.findById(req.params.id);

  if (!review) {
    return next(
      new ErrorResponse(`No review with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure review belongs to user or user is admin
  if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`Not authorized to update review`, 401));
  }

  // Prevent updating the property
  if (req.body.property) {
    delete req.body.property;
  }

  review = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  // Recalculate average rating for the property
  await calculateAverageRating(review.property);

  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Delete review
// @route   DELETE /api/v1/reviews/:id
// @access  Private
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(
      new ErrorResponse(`No review with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure review belongs to user or user is admin
  if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`Not authorized to delete review`, 401));
  }

  const propertyId = review.property;
  
  await review.remove();

  // Recalculate average rating for the property
  await calculateAverageRating(propertyId);

  res.status(200).json({
    success: true,
    data: {}
  });
});

// Helper function to calculate average rating for a property
const calculateAverageRating = async (propertyId) => {
  const stats = await Review.aggregate([
    {
      $match: { property: propertyId }
    },
    {
      $group: {
        _id: '$property',
        averageRating: { $avg: '$rating' },
        numberOfReviews: { $sum: 1 }
      }
    }
  ]);

  try {
    await Property.findByIdAndUpdate(propertyId, {
      averageRating: stats[0] ? Math.ceil(stats[0].averageRating * 10) / 10 : 0,
      numberOfReviews: stats[0] ? stats[0].numberOfReviews : 0
    });
  } catch (err) {
    console.error(err);
  }
};

// @desc    Get reviews for a specific user
// @route   GET /api/v1/users/:userId/reviews
// @access  Private/Admin
exports.getUserReviews = asyncHandler(async (req, res, next) => {
  const reviews = await Review.find({ user: req.params.userId })
    .populate({
      path: 'property',
      select: 'title'
    });

  res.status(200).json({
    success: true,
    count: reviews.length,
    data: reviews
  });
});

// @desc    Get my reviews
// @route   GET /api/v1/reviews/me
// @access  Private
exports.getMyReviews = asyncHandler(async (req, res, next) => {
  const reviews = await Review.find({ user: req.user.id })
    .populate({
      path: 'property',
      select: 'title images'
    });

  res.status(200).json({
    success: true,
    count: reviews.length,
    data: reviews
  });
});

// @desc    Get reviews for my properties
// @route   GET /api/v1/reviews/my-properties
// @access  Private (Property Owner)
exports.getMyPropertyReviews = asyncHandler(async (req, res, next) => {
  // Get all properties owned by the user
  const properties = await Property.find({ createdBy: req.user.id });
  const propertyIds = properties.map(property => property._id);

  // Find all reviews for these properties
  const reviews = await Review.find({ property: { $in: propertyIds } })
    .populate({
      path: 'property',
      select: 'title'
    })
    .populate({
      path: 'user',
      select: 'name'
    });

  res.status(200).json({
    success: true,
    count: reviews.length,
    data: reviews
  });
});

// @desc    Reply to a review
// @route   PUT /api/v1/reviews/:id/reply
// @access  Private (Property Owner)
exports.replyToReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate({
    path: 'property',
    select: 'createdBy'
  });

  if (!review) {
    return next(
      new ErrorResponse(`No review found with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure the user is the property owner
  if (review.property.createdBy.toString() !== req.user.id) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to reply to this review`,
        401
      )
    );
  }

  // Check if there's already a reply
  if (review.reply) {
    return next(
      new ErrorResponse('A reply already exists for this review', 400)
    );
  }

  review.reply = {
    text: req.body.text,
    user: req.user.id,
    date: Date.now()
  };

  await review.save();

  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Update reply to a review
// @route   PUT /api/v1/reviews/:id/reply
// @access  Private (Property Owner)
exports.updateReviewReply = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate({
    path: 'property',
    select: 'createdBy'
  });

  if (!review) {
    return next(
      new ErrorResponse(`No review found with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure the user is the property owner or admin
  if (
    review.property.createdBy.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this reply`,
        401
      )
    );
  }

  // Check if there's a reply to update
  if (!review.reply) {
    return next(
      new ErrorResponse('No reply exists for this review', 400)
    );
  }

  // Only the original replier or admin can update the reply
  if (
    review.reply.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this reply`,
        401
      )
    );
  }

  // Update the reply
  review.reply.text = req.body.text || review.reply.text;
  review.reply.updatedAt = Date.now();

  await review.save();

  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Delete reply to a review
// @route   DELETE /api/v1/reviews/:id/reply
// @access  Private (Property Owner/Admin)
exports.deleteReviewReply = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate({
    path: 'property',
    select: 'createdBy'
  });

  if (!review) {
    return next(
      new ErrorResponse(`No review found with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure the user is the property owner or admin
  if (
    review.property.createdBy.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this reply`,
        401
      )
    );
  }

  // Check if there's a reply to delete
  if (!review.reply) {
    return next(
      new ErrorResponse('No reply exists for this review', 400)
    );
  }

  // Only the original replier or admin can delete the reply
  if (
    review.reply.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this reply`,
        401
      )
    );
  }

  // Remove the reply
  review.reply = undefined;

  await review.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});
