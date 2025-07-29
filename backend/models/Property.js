const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title for the property'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please provide a price'],
    min: [0, 'Price cannot be negative']
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'South Africa' }
  },
  features: {
    bedrooms: { type: Number, required: true, min: 0 },
    bathrooms: { type: Number, required: true, min: 0 },
    parking: { type: Boolean, default: false },
    furnished: { type: Boolean, default: false },
    availableFrom: { type: Date, required: true },
    availableTo: { type: Date }
  },
  images: [{
    url: String,
    publicId: String,
    isFeatured: { type: Boolean, default: false }
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for bookings
propertySchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'property',
  justOne: false
});

// Ensure virtuals are included when converting to JSON
propertySchema.set('toJSON', { virtuals: true });
propertySchema.set('toObject', { virtuals: true });

// Indexes for better query performance
propertySchema.index({ title: 'text', description: 'text' });
propertySchema.index({ 'address.city': 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ isAvailable: 1 });

// Middleware to update the updatedAt field
propertySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to search properties
propertySchema.statics.searchProperties = async function(query) {
  const { keyword, minPrice, maxPrice, city, availableFrom, availableTo } = query;
  
  const searchQuery = {};
  
  if (keyword) {
    searchQuery.$text = { $search: keyword };
  }
  
  if (minPrice || maxPrice) {
    searchQuery.price = {};
    if (minPrice) searchQuery.price.$gte = minPrice;
    if (maxPrice) searchQuery.price.$lte = maxPrice;
  }
  
  if (city) {
    searchQuery['address.city'] = new RegExp(city, 'i');
  }
  
  // Basic availability check - this can be enhanced based on booking dates
  if (availableFrom) {
    searchQuery['features.availableFrom'] = { $lte: new Date(availableFrom) };
    searchQuery.$or = [
      { 'features.availableTo': { $exists: false } },
      { 'features.availableTo': null },
      { 'features.availableTo': { $gte: new Date(availableFrom) } }
    ];
  }
  
  if (availableTo) {
    searchQuery.$and = searchQuery.$and || [];
    searchQuery.$and.push({
      $or: [
        { 'features.availableTo': { $exists: false } },
        { 'features.availableTo': null },
        { 'features.availableTo': { $gte: new Date(availableTo) } }
      ]
    });
  }
  
  return this.find(searchQuery)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
};

// Instance method to check availability
propertySchema.methods.isAvailableForDates = async function(startDate, endDate) {
  // Check if property is marked as available
  if (!this.isAvailable) return false;
  
  // Check if within available date range
  const availableFrom = this.features.availableFrom;
  const availableTo = this.features.availableTo;
  
  if (startDate < availableFrom) return false;
  if (availableTo && endDate > availableTo) return false;
  
  // Check for conflicting bookings
  const Booking = mongoose.model('Booking');
  const conflictingBooking = await Booking.findOne({
    property: this._id,
    status: { $ne: 'cancelled' },
    $or: [
      { startDate: { $lt: endDate, $gte: startDate } },
      { endDate: { $gt: startDate, $lte: endDate } },
      { 
        startDate: { $lte: startDate },
        endDate: { $gte: endDate }
      }
    ]
  });
  
  return !conflictingBooking;
};

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
