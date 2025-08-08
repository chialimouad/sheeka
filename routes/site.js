/**
 * FILE: ./routes/siteConfigRoutes.js
 * DESC: Defines API endpoints for site and pixel configuration.
 *
 * UPDATE: Added a new public route `GET /public` to fetch site configuration
 * data for the public-facing website. This route only uses the `identifyTenant`
 * middleware and does not require authentication, resolving the 401 error.
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

const { SiteConfigController } = require('../controllers/site');
const { PixelController } = require('../controllers/pixelcontroller');

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
