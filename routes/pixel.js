/**
 * @fileoverview Defines API routes for pixel management and site configuration.
 */

const express = require('express');
const router = express.Router();
const PixelController = require('../controllers/pixelcontroller'); // Import the pixel controller

// POST route to add new Facebook or TikTok pixel IDs
router.post('/pixels', PixelController.postPixel);

// GET route to retrieve all stored pixel IDs
router.get('/pixels', PixelController.getPixels);


module.exports = router;
