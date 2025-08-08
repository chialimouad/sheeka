/**
 * @fileoverview Defines API routes for pixel management and site configuration.
 * All routes defined here are tenant-aware.
 */

const express = require('express');
const router = express.Router();
const { PixelController, SiteConfigController } = require('../controllers/siteConfigController');

// It's assumed that you have middleware to handle authentication and tenant identification.
// For example:
// const { protect } = require('../middleware/authMiddleware');
// const { identifyTenant } = require('../middleware/tenantMiddleware');

// --- Pixel Management Routes (Admin Access) ---
// These routes would be protected by an authentication middleware (`protect`)
// that verifies the user is an admin and attaches their `tenantId` to the request object.

// POST route to add new Facebook or TikTok pixel IDs
router.post('/pixels', /* protect, */ PixelController.postPixel);

// GET route to retrieve all stored pixel IDs for the admin's tenant
router.get('/pixels', /* protect, */ PixelController.getPixels);

// DELETE route to remove a specific pixel ID by its database ID
router.delete('/pixels/:id', /* protect, */ PixelController.deletePixel);


// --- Public Site Configuration Route ---
// This route is public, but a middleware (`identifyTenant`) should run before it
// to identify which tenant's configuration to serve based on the request's domain/subdomain.

// GET route to retrieve general site configuration, including pixel IDs
router.get('/site-config', /* identifyTenant, */ SiteConfigController.getSiteConfig);

module.exports = router;
