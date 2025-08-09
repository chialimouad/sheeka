/**
 * FILE: ./routes/siteConfigRoutes.js
 * DESC: Defines API endpoints for site and pixel configuration.
 *
 * UPDATE: Corrected the require paths for the controllers to ensure
 * the server can find and register the API routes correctly. This resolves
 * the issue where the settings page could not fetch or update data.
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

// FIX: Corrected the paths to the controller files.
const { SiteConfigController } = require('../controllers/siteConfigController');
const { PixelController } = require('../controllers/pixelController');

const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// --- Public Route ---

// GET the public site configuration for the current tenant
router.get(
    '/public',
    identifyTenant,
    SiteConfigController.getPublicSiteConfig
);

// --- Admin-Only Routes ---

// GET the full site configuration for the current tenant (Admin only)
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

// --- Pixel Tracking Routes (Admin Only) ---

router.get(
    '/pixels',
    identifyTenant,
    protect,
    isAdmin,
    PixelController.getPixels
);

router.post(
    '/pixels',
    identifyTenant,
    protect,
    isAdmin,
    PixelController.postPixel
);

router.delete(
    '/pixels/:id',
    identifyTenant,
    protect,
    isAdmin,
    [param('id').isMongoId().withMessage('Invalid Pixel ID format.')],
    PixelController.deletePixel
);

module.exports = router;
