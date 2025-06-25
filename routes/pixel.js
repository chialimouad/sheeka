// pixelRoutes.js (Route Definitions)
// This file defines the API endpoints and maps them to the corresponding controller functions.

// Import the Express router to create modular, mountable route handlers
const express = require('express');
const router = express.Router(); // Create a new router instance

// Import the PixelController to link routes to controller functions
const PixelController = require('../controllers/pixelcontroller');

// Define routes:

// POST route to create a new pixel entry
// When a POST request is made to '/pixels', the postPixel function from PixelController will be executed.
router.post('/pixels', PixelController.postPixel);

// GET route to fetch all pixel entries
// When a GET request is made to '/pixels', the getPixels function from PixelController will be executed.
router.get('/pixels', PixelController.getPixels);

// Export the router so it can be 'used' by the main Express app (server.js)
module.exports = router;
