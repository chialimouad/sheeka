/**
 * @fileoverview Mongoose Pixel Model for interacting with a MongoDB database.
 * This model defines the schema for storing Facebook and TikTok pixel IDs.
 */

const mongoose = require('mongoose');

const PixelSchema = new mongoose.Schema({
  fbPixelId: {
    type: String,
    unique: true, // Ensures uniqueness for fbPixelId
    sparse: true, // Allows multiple documents to have a null/undefined fbPixelId
  },
  tiktokPixelId: {
    type: String,
    unique: true, // Ensures uniqueness for tiktokPixelId
    sparse: true, // Allows multiple documents to have a null/undefined tiktokPixelId
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically sets the creation timestamp
  },
});

// Static method to create a new pixel entry in the database.
// This method takes pixelData (containing fbPixelId and/or tiktokPixelId)
// and saves it as a new document in the 'pixels' collection.
PixelSchema.statics.createPixel = async function (pixelData) {
  const pixel = new this(pixelData);
  return await pixel.save();
};

// Static method to fetch all pixel entries from the database,
// sorted by creation date in descending order (newest first).
PixelSchema.statics.getAllPixels = async function () {
  return await this.find().sort({ createdAt: -1 });
};

// Static method to fetch the latest (most recently created) pixel configuration.
// This is used to retrieve the active Facebook and TikTok pixel IDs for the site.
PixelSchema.statics.getLatestPixelConfig = async function () {
  // Find one document, sorted by createdAt in descending order to get the latest one.
  const latestPixel = await this.findOne().sort({ createdAt: -1 });

  // If a pixel configuration is found, return its IDs; otherwise, return an empty object.
  if (latestPixel) {
    return {
      facebookPixelId: latestPixel.fbPixelId,
      tiktokPixelId: latestPixel.tiktokPixelId
    };
  }
  return {}; // No pixel configuration found
};

// Static method to delete a pixel entry by its ID.
// This method finds and deletes a document based on the provided ID.
PixelSchema.statics.deletePixel = async function (pixelId) {
  return await this.findByIdAndDelete(pixelId);
};

// Export the Mongoose model named 'Pixel'.
// This will create a collection named 'pixels' in your MongoDB database.
module.exports = mongoose.model('Pixel', PixelSchema);
