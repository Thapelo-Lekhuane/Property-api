const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property is required for booking']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required for booking']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  guests: {
    type: Number,
    required: [true, 'Number of guests is required'],
    min: [1, 'At least one guest is required']
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'refunded', 'failed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['eft', 'credit_card', 'cash'],
    required: [true, 'Payment method is required']
  },
  paymentProof: {
    url: String,
    publicId: String,
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot be longer than 500 characters']
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot be longer than 500 characters']
  },
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  checkIn: {
    type: Date,
    default: null
  },
  checkOut: {
    type: Date,
    default: null
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    maxlength: [1000, 'Review cannot be longer than 1000 characters']
  },
  reviewDate: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
bookingSchema.index({ property: 1 });
bookingSchema.index({ user: 1 });
bookingSchema.index({ startDate: 1, endDate: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });

// Virtual for property details
bookingSchema.virtual('propertyDetails', {
  ref: 'Property',
  localField: 'property',
  foreignField: '_id',
  justOne: true
});

// Virtual for user details
bookingSchema.virtual('userDetails', {
  ref: 'User',
  localField: 'user',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included when converting to JSON
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

// Pre-save hook to calculate total price if not provided
bookingSchema.pre('save', async function(next) {
  if (!this.isModified('startDate') && !this.isModified('endDate') && this.totalPrice) {
    return next();
  }
  
  try {
    const Property = mongoose.model('Property');
    const property = await Property.findById(this.property);
    
    if (!property) {
      throw new Error('Property not found');
    }
    
    // Calculate number of nights
    const nights = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
    
    // Calculate total price (price per night * number of nights)
    this.totalPrice = property.price * nights;
    
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to check date availability
bookingSchema.statics.isDateRangeAvailable = async function(propertyId, startDate, endDate, excludeBookingId = null) {
  const query = {
    property: propertyId,
    status: { $ne: 'cancelled' },
    $or: [
      { startDate: { $lt: endDate, $gte: startDate } },
      { endDate: { $gt: startDate, $lte: endDate } },
      { 
        startDate: { $lte: startDate },
        endDate: { $gte: endDate }
      }
    ]
  };
  
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  
  const count = await this.countDocuments(query);
  return count === 0;
};

// Instance method to cancel booking
bookingSchema.methods.cancel = async function(userId, reason = '') {
  this.status = 'cancelled';
  this.cancelledAt = Date.now();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  await this.save();
  return this;
};

// Instance method to confirm booking
bookingSchema.methods.confirm = async function() {
  this.status = 'confirmed';
  await this.save();
  return this;
};

// Instance method to mark as completed
bookingSchema.methods.complete = async function() {
  this.status = 'completed';
  await this.save();
  return this;
};

// Instance method to add payment proof
bookingSchema.methods.addPaymentProof = async function(url, publicId, verifiedBy = null) {
  this.paymentProof = {
    url,
    publicId,
    verified: !!verifiedBy,
    verifiedAt: verifiedBy ? Date.now() : null,
    verifiedBy: verifiedBy || undefined
  };
  
  if (verifiedBy) {
    this.paymentStatus = 'paid';
  }
  
  await this.save();
  return this;
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
