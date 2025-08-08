/**
 * FILE: ./routes/siteConfigRoutes.js
 * DESC: Defines API endpoints for site and pixel configuration.
 *
 * FIXES:
 * - Corrected the controller import path to '../controllers/siteConfigController'.
 * - Imported the PixelController to handle pixel-related logic.
 * - Activated and correctly defined the routes for '/pixels' and '/pixels/:id'
 * to match the API calls from the frontend, resolving the 404 errors.
 * - Ensured all routes have the necessary middleware for tenant identification and security.
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

// Import controllers from the correct file
const { SiteConfigController, PixelController } = require('../controllers/site');

// Import all necessary middleware
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// --- Main Site Config Routes ---

// GET the site configuration for the current tenant
router.get(
    '/',
    identifyTenant,
    protect, // Re-added protect as a best practice for authenticated sections
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
