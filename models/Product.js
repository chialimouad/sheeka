const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  // The description will store HTML content from a rich text editor
  description: { 
    type: String, 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true 
  },
  // Added field for the original price (optional)
  olprice: {
    type: Number,
    required: false // This is optional, as not all products may have a sale price
  },
  // Added field for a promotional code (optional)
  promocode: {
    type: String,
    required: false // This is optional, as a promo code may not always apply
  },
  // An array of URLs for the main product images
  images: { 
    type: [String], 
    required: true 
  },
  variants: [{
    colors: { 
      type: [String], 
      required: true 
    },
    sizes: { 
      type: [String], 
      required: true 
    }
  }],
}, { 
  // Adds createdAt & updatedAt fields automatically
  timestamps: true 
});

module.exports = mongoose.model('Product', productSchema);
