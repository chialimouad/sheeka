const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  quantity: Number,
  price: Number,
  images: [String],
}, { timestamps: true }); // ✅ Adds createdAt & updatedAt fields automatically

module.exports = mongoose.model('Product', productSchema);
