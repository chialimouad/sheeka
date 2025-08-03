/**
 * FILE: ./controllers/siteConfigController.js
 * DESC: Handles business logic for site and pixel configurations.
 *
 * FIX:
 * - All database queries now use `req.tenantObjectId` instead of `req.tenant.tenantId`.
 * - The `identifyTenant` middleware provides `req.tenantObjectId` as the client's
 * unique MongoDB `_id`, which is the correct data type for querying related
 * collections like SiteConfig and PixelModel. This resolves the `CastError`.
 */
const PixelModel = require('../models/pixel');
const SiteConfig = require('../models/sitecontroll');
const { validationResult, param } = require('express-validator');

// =========================
// Pixel Handlers (Tenant-Aware)
// =========================

const PixelController = {
    postPixel: async (req, res) => {
        try {
            const { fbPixelId, tiktokPixelId } = req.body;
            // Use the MongoDB ObjectId for consistency in relations.
            const tenantObjectId = req.tenantObjectId;

            const newPixel = await PixelModel.create({ // Assuming a simple create
                fbPixelId,
                tiktokPixelId,
                tenantId: tenantObjectId // Save the ObjectId reference
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

    getPixels: async (req, res) => {
        try {
            const tenantObjectId = req.tenantObjectId;
            const pixels = await PixelModel.find({ tenantId: tenantObjectId });
            res.status(200).json({
                message: 'Fetched all pixel IDs successfully!',
                pixels
            });
        } catch (error) {
            console.error('Error fetching pixel IDs:', error);
            res.status(500).json({ message: 'Failed to fetch pixel IDs.' });
        }
    },

    deletePixel: [
        param('id').isMongoId().withMessage('Invalid Pixel ID format.'),
        async (req, res) => {
            // ... validation ...
            try {
                const pixelId = req.params.id;
                const tenantObjectId = req.tenantObjectId;

                const deletedPixel = await PixelModel.findOneAndDelete({ _id: pixelId, tenantId: tenantObjectId });

                if (!deletedPixel) {
                    return res.status(404).json({ message: 'Pixel ID not found for this tenant.' });
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
    getSiteConfig: async (req, res) => {
        try {
            // Use the MongoDB ObjectId provided by the middleware.
            const tenantObjectId = req.tenantObjectId;

            const [siteConfig, pixelConfig] = await Promise.all([
                SiteConfig.findOne({ tenantId: tenantObjectId }), // Find by ObjectId
                PixelModel.findOne({ tenantId: tenantObjectId }).sort({ createdAt: -1 }) // Find latest by ObjectId
            ]);
            
            if (!siteConfig) {
                // Handle case where config might not exist yet for a tenant
                return res.status(404).json({ message: 'Site configuration not found for this tenant.' });
            }

            const fullConfig = {
                ...siteConfig.toObject(),
                facebookPixelId: pixelConfig ? pixelConfig.fbPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null,
            };

            res.status(200).json(fullConfig);
        } catch (error) {
            console.error('Error fetching site configuration:', error);
            res.status(500).json({ message: 'Failed to fetch site configuration.' });
        }
    },

    updateSiteConfig: async (req, res) => {
        try {
            const tenantObjectId = req.tenantObjectId;
            
            const updatedConfig = await SiteConfig.findOneAndUpdate(
                { tenantId: tenantObjectId }, // Query by the correct ObjectId
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
