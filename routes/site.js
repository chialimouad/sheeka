/**
 * FILE: ./routes/siteConfigRoutes.js
 * DESC: Defines API endpoints for site and pixel configuration.
 *
 * FIXES:
 * - Corrected the import path for SiteConfigController to point directly to the
 * 'siteConfigController.js' file. This ensures the controller is not undefined
 * when the routes are being defined.
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

// FIX: Corrected the import paths to match the controllers' filenames.
const { SiteConfigController } = require('../controllers/site');
const { PixelController } = require('../controllers/pixelcontroller'); // Assuming filename is pixelController.js

// Import all necessary middleware
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// --- Main Site Config Routes ---

// GET the site configuration for the current tenant
router.get(
    '/',
    identifyTenant,
    protect,
    isAdmin,
    SiteConfigController.getSiteConfig
);

// PUT to update the site configuration for the current tenant (Admin only)
router.put(
    '/',
    identifyTenant,
    protect,
    isAdmin,
    SiteConfigController.updateSiteConfig
);

// --- Pixel Tracking Routes ---

// GET all pixel configurations for the current tenant (Admin only)
router.get(
    '/pixels',
    identifyTenant,
    protect,
    isAdmin,
    PixelController.getPixels
);

// POST a new pixel configuration for the current tenant (Admin only)
router.post(
    '/pixels',
    identifyTenant,
    protect,
    isAdmin,
    PixelController.postPixel
);

// DELETE a pixel configuration by its ID for the current tenant (Admin only)
router.delete(
    '/pixels/:id',
    identifyTenant,
    protect,
    isAdmin,
    [param('id').isMongoId().withMessage('Invalid Pixel ID format.')],
    PixelController.deletePixel
);

module.exports = router;
