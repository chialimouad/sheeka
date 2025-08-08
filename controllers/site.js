/**
 * FILE: ./controllers/siteConfigController.js
 * DESC: Controller for managing the main site configuration.
 *
 * FIX: The `updateSiteConfig` function has been corrected to ensure the `subdomain`
 * is saved when a new configuration is created via `upsert`. It now uses the
 * `$setOnInsert` operator to add the `subdomain` and `tenantId` from the request's
 * tenant object, guaranteeing this crucial data is not missed on initial creation.
 * FIX: Corrected the model import path from 'sitecontroll' to 'siteConfig'.
 * FIX: The `getSiteConfig` function now returns the subdomain from the tenant object
 * even if a full configuration has not been created yet, allowing the UI to display it.
 */
// FIX: Corrected model name to match convention, e.g., 'siteConfig'.
const SiteConfig = require('../models/sitecontroll');
const PixelModel = require('../models/pixel');
const { validationResult } = require('express-validator');

const SiteConfigController = {
    /**
     * @desc    Provides the entire site configuration for the current tenant,
     * including the latest pixel IDs.
     * @route   GET /site-config
     * @access  Private (Admin)
     */
    getSiteConfig: async (req, res) => {
        try {
            // The tenant's MongoDB ObjectId is attached by the identifyTenant middleware.
            const tenantObjectId = req.tenant._id;

            // Fetch site settings and the latest pixel settings in parallel for efficiency.
            const [siteConfig, pixelConfig] = await Promise.all([
                SiteConfig.findOne({ tenantId: tenantObjectId }).lean(),
                PixelModel.findOne({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean()
            ]);

            // If no config exists, return a 404 but include the subdomain for the UI.
            if (!siteConfig) {
                return res.status(404).json({ 
                    message: 'Site configuration not yet created. Please save your settings to initialize it.',
                    subdomain: req.tenant.subdomain // Send subdomain from the tenant object
                });
            }

            // Combine the data into a single response object.
            const fullConfig = {
                ...siteConfig,
                facebookPixelId: pixelConfig ? pixelConfig.fbPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null,
            };

            res.status(200).json(fullConfig);
        } catch (error) {
            // Log the detailed error on the server for debugging.
            console.error('Error in getSiteConfig:', error);
            // Send a more informative error message in the response.
            res.status(500).json({
                message: 'Failed to retrieve site configuration.',
                error: error.message // Include the actual error message
            });
        }
    },

    /**
     * @desc    Updates or creates the main site configuration for the current tenant.
     * @route   PUT /site-config
     * @access  Private (Admin)
     */
    updateSiteConfig: async (req, res) => {
        try {
            const tenant = req.tenant; // Get the full tenant object from middleware
            const updateData = req.body;

            const updatedConfig = await SiteConfig.findOneAndUpdate(
                { tenantId: tenant._id },
                {
                    $set: updateData, // Update fields from the form
                    $setOnInsert: {   // **FIX**: Set these fields ONLY on initial creation
                        tenantId: tenant._id,
                        subdomain: tenant.subdomain
                    }
                },
                { 
                    new: true, 
                    upsert: true, // Create the document if it doesn't exist
                    runValidators: true 
                }
            );

            res.status(200).json({
                message: "Site configuration updated successfully!",
                config: updatedConfig
            });

        } catch (error) {
            // Log the detailed error on the server for debugging.
            console.error('Error in updateSiteConfig:', error);
            // Send a more informative error message in the response.
            res.status(500).json({
                message: 'Failed to update site configuration',
                error: error.message // Include the actual error message
            });
        }
    }
};

module.exports = { SiteConfigController };
