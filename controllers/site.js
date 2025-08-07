/**
 * FILE: ./controllers/siteConfigController.js
 * DESC: Handles business logic for site and pixel configurations.
 *
 * FIX:
 * - Corrected the model import path from 'sitecontroll' to 'SiteConfig'.
 * - Refactored `getSiteConfig` to use the robust `SiteConfig.findOrCreateForTenant` static method. This simplifies the controller, prevents errors, and ensures that a complete, default configuration is always returned for new tenants.
 * - **SECURITY FIX**: Modified `updateSiteConfig` to no longer pass `req.body` directly to the database. Instead, it now explicitly destructures and validates expected fields, preventing potential data corruption or security vulnerabilities from malicious requests.
 */
const PixelModel = require('../models/pixel');
const SiteConfig = require('../models/SiteConfig'); // FIX: Corrected model import path
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

            // Use the findOrCreateForTenant static method from the model.
            // This simplifies logic and ensures a default config is always available.
            const siteConfig = await SiteConfig.findOrCreateForTenant(tenantObjectId);
            
            const pixelConfig = await PixelModel.findOne({ tenantId: tenantObjectId }).sort({ createdAt: -1 });
            
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
            
            // **SECURITY FIX**: Explicitly define which fields can be updated.
            // This prevents users from injecting unwanted data.
            const {
                siteName,
                slogan,
                heroTitle,
                heroButtonText,
                heroImageUrl,
                primaryColor,
                secondaryColor,
                tertiaryColor,
                generalTextColor,
                footerBgColor,
                footerTextColor,
                footerLinkColor,
                aboutUsText,
                aboutUsImageUrl,
                contactInfo,
                socialMediaLinks,
                currentDataIndex
            } = req.body;

            const updateData = {
                siteName,
                slogan,
                heroTitle,
                heroButtonText,
                heroImageUrl,
                primaryColor,
                secondaryColor,
                tertiaryColor,
                generalTextColor,
                footerBgColor,
                footerTextColor,
                footerLinkColor,
                aboutUsText,
                aboutUsImageUrl,
                contactInfo,
                socialMediaLinks,
                currentDataIndex
            };

            const updatedConfig = await SiteConfig.findOneAndUpdate(
                { tenantId: tenantObjectId }, // Query by the correct ObjectId
                { $set: updateData },
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
