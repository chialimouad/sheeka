// pixelController.js (Controller Logic)
// This file contains the business logic for handling requests related to pixels.
// It interacts with the model to perform data operations and sends responses back to the client.

// Import the PixelModel to interact with our data
const PixelModel = require('../models/pixel');

const PixelController = {
  /**
   * Handles the creation of a new pixel entry.
   * Expected request body: { "fbPixelId": "YOUR_FB_PIXEL_ID", "tiktokPixelId": "YOUR_TIKTOK_PIXEL_ID" }
   * @param {object} req - The Express request object.
   * @param {object} res - The Express response object.
   */
  postPixel: async (req, res) => { // Made async to await model operations
    // Destructure fbPixelId and tiktokPixelId from the request body
    const { fbPixelId, tiktokPixelId } = req.body;

    // Input validation: Check if both IDs are provided
    if (!fbPixelId || !tiktokPixelId) {
      // If not, send a 400 Bad Request response with an error message
      return res.status(400).json({ message: 'Both fbPixelId and tiktokPixelId are required.' });
    }

    try {
      // Call the model to create a new pixel entry. Await the promise.
      const newPixel = await PixelModel.createPixel({ fbPixelId, tiktokPixelId });
      // Send a 201 Created response with the newly created pixel object
      res.status(201).json({ message: 'Pixel IDs stored successfully!', pixel: newPixel });
    } catch (error) {
      // Handle any potential errors during the creation process,
      // especially unique constraint errors from MongoDB/Mongoose.
      if (error.code === 11000) { // MongoDB duplicate key error code
        return res.status(409).json({ message: 'Pixel ID already exists. Please use unique IDs.', error: error.message });
      }
      console.error('Error saving pixel IDs:', error);
      res.status(500).json({ message: 'Failed to save pixel IDs.', error: error.message });
    }
  },

  /**
   * Handles fetching all existing pixel entries.
   * @param {object} req - The Express request object.
   * @param {object} res - The Express response object.
   */
  getPixels: async (req, res) => { // Made async to await model operations
    try {
      // Call the model to retrieve all pixel entries. Await the promise.
      const pixels = await PixelModel.getAllPixels();
      // Send a 200 OK response with the array of pixels
      res.status(200).json({ message: 'Fetched all pixel IDs successfully!', pixels });
    } catch (error) {
      // Handle any potential errors during the fetching process
      console.error('Error fetching pixel IDs:', error);
      res.status(500).json({ message: 'Failed to fetch pixel IDs.', error: error.message });
    }
  }
};

// Export the PixelController so it can be used by the routes
module.exports = PixelController;
