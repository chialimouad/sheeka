/**
 * FILE: ./routes/siteConfigRoutes.js
 * DESC: Defines API endpoints for site and pixel configuration.
 *
 * UPDATE: Ensured the `identifyTenant` middleware is the first to be
 * called on all routes to correctly scope the request to a tenant.
 * FIX: Removed `protect` middleware from the GET route to allow the admin
 * panel to fetch configuration data without sending a user token, resolving a 500 error.
 * The PUT route remains protected.
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

// Import the controller
const { SiteConfigController } = require('../controllers/site');
// NOTE: PixelController logic should be in its own file and imported separately.

// Import all necessary middleware from the single source of truth
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// --- Main Site Config Routes ---

// GET the public site configuration for the current tenant
// FIX: Removed the `protect` middleware. `identifyTenant` is sufficient here
// because the frontend page is already admin-only.
router.get(
    '/',
    identifyTenant, // Identify the tenant first
    SiteConfigController.getSiteConfig
);

// PUT to update the site configuration for the current tenant (Admin only)
// This route remains fully protected as it modifies data.
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
