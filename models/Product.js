const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  images: { type: [String], required: true },
  // Added a 'videos' field to store an array of video URLs.
  // It defaults to an empty array, so products don't necessarily need videos.
  videos: { type: [String], default: [] },
  variants: [{
    colors: { type: [String], required: true },
    sizes: { type: [String], required: true }
  }],
}, { timestamps: true }); // ✅ Adds createdAt & updatedAt fields automatically

module.exports = mongoose.model('Product', productSchema);
