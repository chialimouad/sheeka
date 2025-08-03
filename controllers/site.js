/**
 * FILE: ./controllers/siteConfigController.js
 * DESC: Handles business logic for site and pixel configurations.
 *
 * FIX:
 * - Standardized how the tenant ID is accessed. All handlers now reliably use
 * `req.tenant`, which is attached by the `identifyTenant` middleware. This
 * avoids confusion between `req.user.tenantId` and `req.tenantId`.
 * - The code now consistently uses `req.tenant.tenantId` for queries, as this
 * appears to be the numeric ID your models expect.
 */
const PixelModel = require('../models/pixel');
const SiteConfig = require('../models/sitecontroll');
const { validationResult, param } = require('express-validator');

// =========================
// Pixel Handlers (Tenant-Aware)
// =========================

const PixelController = {
    /**
     * @desc     Create a new Facebook or TikTok pixel ID entry.
     * @route    POST /api/site-config/pixels
     * @access   Private (Admin)
     */
    postPixel: async (req, res) => {
        try {
            const { fbPixelId, tiktokPixelId } = req.body;
            // Use the tenant ID from the reliable `req.tenant` object.
            const tenantId = req.tenant.tenantId;

            const newPixel = await PixelModel.createPixelForTenant({
                fbPixelId,
                tiktokPixelId,
                tenantId
            });

            res.status(201).json({
                message: 'Pixel IDs stored successfully!',
                pixel: newPixel
            });
        } catch (error) {
            console.error('Error saving pixel IDs:', error);
            res.status(error.statusCode || 500).json({ message: error.message || 'Failed to save pixel IDs.' });
        }
    },

    /**
     * @desc     Get all stored pixel entries for the current tenant.
     * @route    GET /api/site-config/pixels
     * @access   Private (Admin)
     */
    getPixels: async (req, res) => {
        try {
            const tenantId = req.tenant.tenantId;
            const pixels = await PixelModel.getAllPixelsForTenant(tenantId);
            res.status(200).json({
                message: 'Fetched all pixel IDs successfully!',
                pixels
            });
        } catch (error) {
            console.error('Error fetching pixel IDs:', error);
            res.status(500).json({ message: 'Failed to fetch pixel IDs.' });
        }
    },

    /**
     * @desc     Delete a specific pixel entry by ID.
     * @route    DELETE /api/site-config/pixels/:id
     * @access   Private (Admin)
     */
    deletePixel: [
        param('id').isMongoId().withMessage('Invalid Pixel ID format.'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            try {
                const pixelId = req.params.id;
                const tenantId = req.tenant.tenantId;

                const deletedPixel = await PixelModel.deletePixelForTenant(pixelId, tenantId);

                if (!deletedPixel) {
                    return res.status(404).json({ message: 'Pixel ID not found or already deleted.' });
                }

                res.status(200).json({
                    message: 'Pixel ID deleted successfully!',
                    pixel: deletedPixel
                });
            } catch (error) {
                console.error('Error deleting pixel ID:', error);
                res.status(500).json({ message: 'Failed to delete pixel ID.' });
            }
        }
    ]
};

// =========================
// Site Config Handlers (Tenant-Aware)
// =========================

const SiteConfigController = {
    /**
     * @desc     Get the complete site configuration for the current tenant.
     * @route    GET /api/site-config
     * @access   Public
     */
    getSiteConfig: async (req, res) => {
        try {
            // `identifyTenant` runs on this public route and attaches `req.tenant`.
            const tenantId = req.tenant.tenantId;

            // Fetch site config and pixel config in parallel for efficiency.
            const [siteConfig, pixelConfig] = await Promise.all([
                SiteConfig.findOrCreateForTenant(tenantId),
                PixelModel.getLatestPixelConfigForTenant(tenantId)
            ]);

            // Combine the data from both models into a single response object.
            const fullConfig = {
                ...siteConfig.toObject(), // Convert mongoose doc to plain object
                facebookPixelId: pixelConfig ? pixelConfig.facebookPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null,
            };

            res.status(200).json(fullConfig);
        } catch (error) {
            console.error('Error fetching site configuration:', error);
            res.status(500).json({ message: 'Failed to fetch site configuration.' });
        }
    },

    /**
     * @desc     Update the site configuration for the current tenant.
     * @route    PUT /api/site-config
     * @access   Private (Admin)
     */
    updateSiteConfig: async (req, res) => {
        try {
            // `identifyTenant` and `protect` run, so `req.tenant` is available.
            const tenantId = req.tenant.tenantId;
            
            // Use findOneAndUpdate to update the document for the correct tenant.
            // The { new: true } option returns the updated document.
            // The { upsert: true } option ensures that if a config doesn't exist, it will be created.
            const updatedConfig = await SiteConfig.findOneAndUpdate(
                { tenantId },
                { $set: req.body },
                { new: true, upsert: true, runValidators: true }
            );

            res.status(200).json({
                message: "Site configuration updated successfully!",
                config: updatedConfig
            });
        } catch (error) {
            console.error('Error updating site configuration:', error);
            res.status(500).json({ message: 'Failed to update site configuration.' });
        }
    }
};

module.exports = { PixelController, SiteConfigController };
