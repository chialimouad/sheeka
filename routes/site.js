/**
 * FILE: ./routes/siteConfigRoutes.js
 * DESC: Defines API endpoints for site and pixel configuration.
 *
 * UPDATE: Ensured the `identifyTenant` middleware is the first to be
 * called on all routes to correctly scope the request to a tenant.
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

// Import the controller
const { SiteConfigController, PixelController } = require('../controllers/site');

// Import all necessary middleware from the single source of truth
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// --- Main Site Config Routes ---

// GET the public site configuration for the current tenant
router.get(
    '/',
    identifyTenant, // Identify the tenant first
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

module.exports = router;
