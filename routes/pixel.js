/**
 * @fileoverview Defines API routes for pixel management and site configuration.
 */

const express = require('express');
const router = express.Router();
const { PixelController, SiteConfigController } = require('../controllers/pixelcontroller'); // Import both controllers

// POST route to add new Facebook or TikTok pixel IDs
router.post('/pixels', PixelController.postPixel);

// GET route to retrieve all stored pixel IDs
router.get('/pixels', PixelController.getPixels);

// DELETE route to remove a specific pixel ID by its database ID
router.delete('/pixels/:id', PixelController.deletePixel);

// GET route to retrieve general site configuration, including pixel IDs
router.get('/site-config', SiteConfigController.getSiteConfig); // Corrected to use SiteConfigController

module.exports = router;
