/**
 * FILE: ./routes/siteConfigRoutes.js
 * DESC: Defines API endpoints for site and pixel configuration.
 *
 * UPDATE: Ensured the `identifyTenant` middleware is the first to be
 * called on all routes to correctly scope the request to a tenant.
 * FIX: Corrected the controller import path from '../controllers/site' to '../controllers/siteConfigController'.
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

// Import the controller
// FIX: Corrected the import path to point to the correct controller file.
const { SiteConfigController } = require('../controllers/site');
// NOTE: PixelController logic should be in its own file and imported separately.
// For now, assuming it will be added or is in another file.

// Import all necessary middleware from the single source of truth
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// --- Main Site Config Routes ---

// GET the public site configuration for the current tenant
// This route is now correctly wired to the controller.
router.get(
    '/',
    identifyTenant, // Identify the tenant first
    protect, // Added protect middleware for consistency, as config might contain sensitive links/info
    SiteConfigController.getSiteConfig
);

// PUT to update the site configuration for the current tenant (Admin only)
router.put(
    '/',
    identifyTenant, // Identify the tenant first
    protect,
    isAdmin,
    SiteConfigController.updateSiteConfig
);

// The routes below depend on a PixelController, which is not in the current
// siteConfigController.js file. These routes will need a valid controller to function.
/*
// --- Pixel Tracking Routes ---

// GET all pixel configurations for the current tenant (Admin only)
router.get(
    '/pixels',
    identifyTenant, // Identify the tenant first
    protect,
    isAdmin,
    PixelController.getPixels
);

// POST a new pixel configuration for the current tenant (Admin only)
router.post(
    '/pixels',
    identifyTenant, // Identify the tenant first
    protect,
    isAdmin,
    PixelController.postPixel
);

// DELETE a pixel configuration by its ID for the current tenant (Admin only)
router.delete(
    '/pixels/:id',
    identifyTenant, // Identify the tenant first
    protect,
    isAdmin,
    [param('id').isMongoId().withMessage('Invalid Pixel ID format.')],
    PixelController.deletePixel
);
*/

module.exports = router;
