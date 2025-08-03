/**
 * FILE: ./controllers/siteConfigController.js
 * DESC: Handles business logic for site and pixel configurations.
 *
 * FIX:
 * - Modified `getSiteConfig` to be more resilient. If a `SiteConfig` document
 * does not exist for a given tenant, a new default configuration is
 * created and returned automatically. This prevents 404 errors on the
 * frontend for new tenants and simplifies client-side logic.
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
            const tenantObjectId = req.tenantObjectId;

            let siteConfig = await SiteConfig.findOne({ tenantId: tenantObjectId });
            const pixelConfig = await PixelModel.findOne({ tenantId: tenantObjectId }).sort({ createdAt: -1 });
            
            // **FIX**: If no config exists, create a default one and save it.
            if (!siteConfig) {
                console.log(`No site config found for tenant ${tenantObjectId}. Creating a default one.`);
                siteConfig = new SiteConfig({
                    tenantId: tenantObjectId,
                    // Add any other default values your schema requires
                    siteName: "My New Site",
                    slogan: "Welcome!",
                    primaryColor: "#4F46E5",
                    secondaryColor: "#EC4899",
                    tertiaryColor: "#10B981",
                    generalTextColor: "#1F2937",
                    footerBgColor: "#111827",
                    footerTextColor: "#F9FAFB",
                    footerLinkColor: "#9CA3AF",
                    aboutUsText: "This is the default about us text. Please update it in the settings.",
                    currentDataIndex: 0
                });
                await siteConfig.save();
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
