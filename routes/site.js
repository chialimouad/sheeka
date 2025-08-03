/**
 * FILE: ./routes/siteConfigRoutes.js
 * DESC: Defines API endpoints for site and pixel configuration.
 *
 * FIX:
 * - Corrected the controller import path. All auth middleware (`identifyTenant`,
 * `protect`, `isAdmin`) is now imported from the single, correct
 * `../middleware/authMiddleware.js` file.
 * - Corrected the controller import path to point to the
 * `siteConfigController.js` file.
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

// FIX: Corrected the import path for the controller.
const {
    SiteConfigController,
    PixelController
} = require('../controllers/site');

// Import the necessary middleware from the single source of truth
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// --- Main Site Config Routes ---

// GET the public site configuration for the current client
router.get(
    '/',
    identifyTenant,
    SiteConfigController.getSiteConfig
);

// PUT to update the site configuration (Admin only)
router.put(
    '/',
    identifyTenant,
    protect,
    isAdmin,
    SiteConfigController.updateSiteConfig
);

// --- Pixel Tracking Routes ---

// GET all pixel configurations for the current client (Admin only)
router.get(
    '/pixels',
    identifyTenant,
    protect,
    isAdmin,
    PixelController.getPixels
);

// POST a new pixel configuration for the current client (Admin only)
router.post(
    '/pixels',
    identifyTenant,
    protect,
    isAdmin,
    PixelController.postPixel
);

// DELETE a pixel configuration by its ID (Admin only)
router.delete(
    '/pixels/:id',
    identifyTenant,
    protect,
    isAdmin,
    [param('id').isMongoId().withMessage('Invalid Pixel ID format.')],
    PixelController.deletePixel
);

module.exports = router;
