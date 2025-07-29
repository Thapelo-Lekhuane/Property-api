const Property = require('../models/Property');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// @desc    Get all properties
// @route   GET /api/v1/properties
// @access  Public
exports.getProperties = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single property
// @route   GET /api/v1/properties/:id
// @access  Public
exports.getProperty = asyncHandler(async (req, res, next) => {
  const property = await Property.findById(req.params.id)
    .populate({
      path: 'bookings',
      select: 'startDate endDate status'
    })
    .populate('createdBy', 'name email phone');

  if (!property) {
    return next(
      new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: property
  });
});

// @desc    Create new property
// @route   POST /api/v1/properties
// @access  Private (Admin)
exports.createProperty = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;

  const property = await Property.create(req.body);

  res.status(201).json({
    success: true,
    data: property
  });
});

// @desc    Update property
// @route   PUT /api/v1/properties/:id
// @access  Private (Admin)
exports.updateProperty = asyncHandler(async (req, res, next) => {
  let property = await Property.findById(req.params.id);

  if (!property) {
    return next(
      new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is property owner or admin
  if (property.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this property`,
        401
      )
    );
  }

  // Update property
  property = await Property.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: property
  });
});

// @desc    Delete property
// @route   DELETE /api/v1/properties/:id
// @access  Private (Admin)
exports.deleteProperty = asyncHandler(async (req, res, next) => {
  const property = await Property.findById(req.params.id);

  if (!property) {
    return next(
      new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is property owner or admin
  if (property.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this property`,
        401
      )
    );
  }

  // Delete images from Cloudinary
  for (const image of property.images) {
    if (image.publicId) {
      await cloudinary.uploader.destroy(image.publicId);
    }
  }

  await property.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Upload photo for property
// @route   PUT /api/v1/properties/:id/photo
// @access  Private
exports.propertyPhotoUpload = asyncHandler(async (req, res, next) => {
  const property = await Property.findById(req.params.id);

  if (!property) {
    return next(
      new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is property owner or admin
  if (property.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this property`,
        401
      )
    );
  }

  if (!req.files) {
    return next(new ErrorResponse(`Please upload a file`, 400));
  }

  const file = req.files.file;

  // Make sure the image is a photo
  if (!file.mimetype.startsWith('image')) {
    return next(new ErrorResponse(`Please upload an image file`, 400));
  }

  // Check filesize
  const maxSize = process.env.MAX_FILE_UPLOAD || 1000000;
  if (file.size > maxSize) {
    return next(
      new ErrorResponse(
        `Please upload an image less than ${process.env.MAX_FILE_UPLOAD}`,
        400
      )
    );
  }

  // Create custom filename
  file.name = `photo_${property._id}${path.parse(file.name).ext}`;

  // Upload to Cloudinary
  try {
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: 'cyc-acres/properties',
      public_id: `property_${property._id}_${Date.now()}`,
      resource_type: 'image'
    });

    // Add to property images array
    property.images.unshift({
      url: result.secure_url,
      publicId: result.public_id,
      isFeatured: property.images.length === 0 // Set as featured if first image
    });

    await property.save();

    res.status(200).json({
      success: true,
      data: property.images
    });
  } catch (err) {
    console.error(err);
    return next(new ErrorResponse(`Problem with file upload`, 500));
  }
});

// @desc    Delete property photo
// @route   DELETE /api/v1/properties/:id/photo/:photoId
// @access  Private
exports.deletePropertyPhoto = asyncHandler(async (req, res, next) => {
  const property = await Property.findById(req.params.id);

  if (!property) {
    return next(
      new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is property owner or admin
  if (property.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this property`,
        401
      )
    );
  }

  // Find the photo to delete
  const photoIndex = property.images.findIndex(
    (img) => img._id.toString() === req.params.photoId
  );

  if (photoIndex === -1) {
    return next(new ErrorResponse(`Photo not found`, 404));
  }

  const photo = property.images[photoIndex];

  // Delete from Cloudinary
  if (photo.publicId) {
    try {
      await cloudinary.uploader.destroy(photo.publicId);
    } catch (err) {
      console.error('Error deleting image from Cloudinary:', err);
      // Continue with local deletion even if Cloudinary deletion fails
    }
  }

  // Remove from array
  property.images.splice(photoIndex, 1);

  // If we deleted the featured image and there are other images, set the first one as featured
  if (photo.isFeatured && property.images.length > 0) {
    property.images[0].isFeatured = true;
  }

  await property.save();

  res.status(200).json({
    success: true,
    data: property.images
  });
});

// @desc    Set featured photo
// @route   PUT /api/v1/properties/:id/photo/:photoId/featured
// @access  Private
exports.setFeaturedPhoto = asyncHandler(async (req, res, next) => {
  const property = await Property.findById(req.params.id);

  if (!property) {
    return next(
      new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is property owner or admin
  if (property.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this property`,
        401
      )
    );
  }

  // Find the photo to feature
  const photoToFeature = property.images.find(
    (img) => img._id.toString() === req.params.photoId
  );

  if (!photoToFeature) {
    return next(new ErrorResponse(`Photo not found`, 404));
  }

  // Update all images to set isFeatured to false
  property.images.forEach((img) => {
    img.isFeatured = false;
  });

  // Set the selected photo as featured
  photoToFeature.isFeatured = true;

  await property.save();

  res.status(200).json({
    success: true,
    data: property.images
  });
});

// @desc    Check property availability
// @route   GET /api/v1/properties/:id/availability
// @access  Public
exports.checkAvailability = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return next(
      new ErrorResponse('Please provide both start and end dates', 400)
    );
  }

  const property = await Property.findById(req.params.id);

  if (!property) {
    return next(
      new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
    );
  }

  const isAvailable = await property.isAvailableForDates(
    new Date(startDate),
    new Date(endDate)
  );

  res.status(200).json({
    success: true,
    data: {
      available: isAvailable,
      property: {
        id: property._id,
        title: property.title,
        price: property.price
      }
    }
  });
});

// @desc    Get properties within a radius
// @route   GET /api/v1/properties/radius/:zipcode/:distance
// @access  Public
exports.getPropertiesInRadius = asyncHandler(async (req, res, next) => {
  // This is a placeholder. In a real app, you would use a geocoding service
  // to convert zipcode to lat/lng and then find properties within the radius
  
  // For now, we'll just return all properties
  const properties = await Property.find();
  
  res.status(200).json({
    success: true,
    count: properties.length,
    data: properties
  });
});
