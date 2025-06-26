const express = require('express');
const router = express.Router();
const PixelController = require('../controllers/pixelcontroller');

// POST: Add new Pixel ID(s)
router.post('/pixels', PixelController.postPixel);

// GET: Fetch all Pixels
router.get('/pixels', PixelController.getPixels);

module.exports = router;
