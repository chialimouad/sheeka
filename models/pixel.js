const mongoose = require('mongoose');

const PixelSchema = new mongoose.Schema({
  fbPixelId: {
    type: String,
    trim: true,
    // You might want to make these unique if only one set of IDs should exist at a time,
    // or if a specific ID should only appear once.
    // However, if you're tracking history, you'd allow duplicates and just fetch the latest.
    // For this 'latest config' scenario, uniqueness per entry isn't strictly necessary
    // but useful if you intend for only ONE active Facebook ID at any point.
    // unique: true // Uncomment if you want each fbPixelId to be unique across all documents
  },
  tiktokPixelId: {
    type: String,
    trim: true,
    // unique: true // Uncomment if you want each tiktokPixelId to be unique across all documents
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // Ensures we can easily sort to find the latest
  }
});

// --- Static Methods ---

/**
 * Retrieves the latest pixel configuration based on the creation date.
 * This is a static method accessible directly on the PixelModel.
 * @returns {object} An object containing facebookPixelId and tiktokPixelId, or an empty object if none found.
 */
PixelSchema.statics.getLatestPixelConfig = async function () {
  const latestPixel = await this.findOne().sort({ createdAt: -1 }).lean(); // .lean() for plain JS object, better performance
  if (latestPixel) {
    return {
      facebookPixelId: latestPixel.fbPixelId,
      tiktokPixelId: latestPixel.tiktokPixelId
    };
  }
  return {}; // No pixel configuration found
};

/**
 * Creates a new pixel entry.
 * @param {object} data - Object containing fbPixelId and/or tiktokPixelId.
 * @returns {object} The newly created pixel document.
 */
PixelSchema.statics.createPixel = async function (data) {
  // Basic validation could also happen here or in the controller
  if (!data.fbPixelId && !data.tiktokPixelId) {
    const error = new Error('At least one of fbPixelId or tiktokPixelId is required.');
    error.statusCode = 400; // Custom property for handling in controller
    throw error;
  }
  return this.create(data);
};

/**
 * Fetches all stored pixel entries.
 * @returns {Array<object>} An array of pixel documents.
 */
PixelSchema.statics.getAllPixels = async function () {
  return this.find({}).sort({ createdAt: -1 }).lean(); // Sort and lean for efficiency
};

/**
 * Deletes a pixel entry by its MongoDB _id.
 * @param {string} id - The MongoDB _id of the pixel entry to delete.
 * @returns {object|null} The deleted pixel document, or null if not found.
 */
PixelSchema.statics.deletePixel = async function (id) {
  return this.findByIdAndDelete(id).lean();
};

// --- Compile and Export the Model ---
const PixelModel = mongoose.model('Pixel', PixelSchema);

module.exports = PixelModel;