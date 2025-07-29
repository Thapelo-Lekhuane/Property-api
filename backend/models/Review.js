const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Review must belong to a property'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Review must be associated with a booking'],
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be more than 5'],
    },
    comment: {
      type: String,
      required: [true, 'Please provide a comment'],
      trim: true,
      maxlength: [1000, 'Comment cannot be more than 1000 characters'],
    },
    reply: {
      text: String,
      repliedAt: Date,
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    isRecommended: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate reviews from the same user for the same booking
reviewSchema.index({ booking: 1, user: 1 }, { unique: true });

// Populate user and property when querying reviews
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo',
  }).populate({
    path: 'reply.user',
    select: 'name role',
  });
  next();
});

// Static method to calculate average rating for a property
reviewSchema.statics.calcAverageRatings = async function (propertyId) {
  const stats = await this.aggregate([
    {
      $match: { property: propertyId },
    },
    {
      $group: {
        _id: '$property',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await this.model('Property').findByIdAndUpdate(propertyId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await this.model('Property').findByIdAndUpdate(propertyId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5, // Default value
    });
  }
};

// Update property ratings after saving a review
reviewSchema.post('save', function () {
  // this points to current review
  this.constructor.calcAverageRatings(this.property);
});

// Update property ratings after updating or deleting a review
reviewSchema.post(/^findOneAnd/, async function (doc) {
  if (doc) {
    await doc.constructor.calcAverageRatings(doc.property);
  }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
