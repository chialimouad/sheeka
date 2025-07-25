const mongoose = require('mongoose');

// Sub-schema for individual reviews
const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User' // Reference to the User model
    },
    name: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});


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
  // Field for the original price (optional)
  olprice: {
    type: Number,
    required: false // Optional, as not all products may have a sale price
  },
  // Field for a promotional code (optional)
  promocode: {
    type: String,
    required: false // Optional, as a promo code may not always apply
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
  // ** NEW ** Array of review sub-documents
  reviews: [reviewSchema],
  // ** NEW ** Field to store the average rating
  rating: {
    type: Number,
    required: true,
    default: 0
  },
  // ** NEW ** Field to store the number of reviews
  numReviews: {
    type: Number,
    required: true,
    default: 0
  }
}, { 
  // Adds createdAt & updatedAt fields automatically
  timestamps: true 
});

module.exports = mongoose.model('Product', productSchema);
