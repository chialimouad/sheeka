// pixelModel.js (Model Definition with Mongoose)
// This file defines the structure of our data (the "model") and how to interact with it,
// using Mongoose for MongoDB database operations.

const mongoose = require('mongoose'); // Import Mongoose

// Define the schema for our Pixel data
const PixelSchema = new mongoose.Schema({
  fbPixelId: {
    type: String,
    required: true, // Facebook Pixel ID is required
    unique: true,   // Ensure each FB Pixel ID is unique
    trim: true      // Remove whitespace from both ends of the string
  },
  tiktokPixelId: {
    type: String,
    required: true, // TikTok Pixel ID is required
    unique: true,   // Ensure each TikTok Pixel ID is unique
    trim: true      // Remove whitespace from both ends of the string
  },
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

// Create a Mongoose model from the schema
const Pixel = mongoose.model('Pixel', PixelSchema);
s