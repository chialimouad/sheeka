const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  quantity: Number,
  price: Number,
  images: [String],
});

module.exports = mongoose.model('Product', productSchema);