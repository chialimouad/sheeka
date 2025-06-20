const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  images: { type: [String], required: true },
  videos: { type: [String], default: [] }, // Added videos field for video paths
  variants: { type: Array, default: [] }, // Changed to a more flexible Array type for variants
}, { timestamps: true }); // ✅ Adds createdAt & updatedAt fields automatically

module.exports = mongoose.model('Product', productSchema);
