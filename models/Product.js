// models/Product.js
const mongoose = require('mongoose');

// Define the schema for the Product model
const productSchema = new mongoose.Schema({
    // Name of the product (String, required)
    name: { type: String, required: true },
    // Description of the product (String, required)
    description: { type: String, required: true },
    // Quantity of the product available (Number, required)
    quantity: { type: Number, required: true },
    // Price of the product (Number, required)
    price: { type: Number, required: true },
    // Array of image paths for the product (Strings, defaults to empty array)
    // These will now store Cloudinary URLs.
    images: { type: [String], default: [] },
    // Array of video paths for the product (Strings, defaults to empty array)
    // These will now store Cloudinary URLs.
    videos: { type: [String], default: [] },
    // Array for product variants (e.g., size, color, defaults to empty array)
    variants: { type: Array, default: [] },
}, { 
    // Add timestamps for createdAt and updatedAt fields automatically
    timestamps: true 
});

// Export the Product model
module.exports = mongoose.model('Product', productSchema);
