const mongoose = require('mongoose');

const PixelSchema = new mongoose.Schema({
  fbPixelId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null/undefined values
  },
  tiktokPixelId: {
    type: String,
    unique: true,
    sparse: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Static method to create a pixel entry
PixelSchema.statics.createPixel = async function (pixelData) {
  const pixel = new this(pixelData);
  return await pixel.save();
};

// Static method to fetch all pixels
PixelSchema.statics.getAllPixels = async function () {
  return await this.find().sort({ createdAt: -1 });
};

module.exports = mongoose.model('Pixel', PixelSchema);
