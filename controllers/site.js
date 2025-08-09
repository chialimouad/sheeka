/**
 * FILE: ./controllers/siteConfigController.js
 * DESC: Controller for managing the main site configuration.
 *
 * UPDATE: Modified `getPublicSiteConfig` to fetch the latest pixel configuration
 * and include it in the public data. This makes the Facebook Pixel ID
 * available to the public-facing product pages.
 */
const SiteConfig = require('../models/sitecontroll');
const PixelModel = require('../models/pixel');
const { validationResult } = require('express-validator');

const SiteConfigController = {
    /**
     * @desc      Provides the public site configuration for the current tenant.
     * @route     GET /site-config/public
     * @access    Public
     */
    getPublicSiteConfig: async (req, res) => {
        try {
            const tenantObjectId = req.tenant._id;
            
            // FIX: Fetch both site config and the latest pixel config in parallel.
            const [siteConfig, pixelConfig] = await Promise.all([
                SiteConfig.findOne({ tenantId: tenantObjectId }).lean(),
                PixelModel.findOne({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean()
            ]);

            if (!siteConfig) {
                // Even if no site config exists, we should not error out the whole page.
                // Send a default response or an empty object.
                return res.status(404).json({ message: 'Site configuration not found.' });
            }

            // Combine the configurations to include the pixel ID.
            const publicConfig = {
                ...siteConfig,
                facebookPixelId: pixelConfig ? pixelConfig.fbPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null,
            };

            res.status(200).json(publicConfig);
        } catch (error) {
            console.error('Error in getPublicSiteConfig:', error);
            res.status(500).json({
                message: 'Failed to retrieve public site configuration.',
                error: error.message
            });
        }
    },

    /**
     * @desc      Provides the entire site configuration for the current tenant (Admin).
     * @route     GET /site-config
     * @access    Private (Admin)
     */
    getSiteConfig: async (req, res) => {
        try {
            const tenantObjectId = req.tenant._id;
            const [siteConfig, pixelConfig] = await Promise.all([
                SiteConfig.findOne({ tenantId: tenantObjectId }).lean(),
                PixelModel.findOne({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean()
            ]);

            if (!siteConfig) {
                return res.status(200).json({ // Return 200 with default data instead of 404
                    message: 'Site configuration not yet created. Please save your settings to initialize it.',
                    subdomain: req.tenant.subdomain 
                });
            }

            const fullConfig = {
                ...(siteConfig || {}),
                subdomain: req.tenant.subdomain,
                facebookPixelId: pixelConfig ? pixelConfig.fbPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null,
            };

            res.status(200).json(fullConfig);
        } catch (error) {
            console.error('Error in getSiteConfig:', error);
            res.status(500).json({
                message: 'Failed to retrieve site configuration.',
                error: error.message
            });
        }
    },

    /**
     * @desc      Updates or creates the main site configuration for the current tenant.
     * @route     PUT /site-config
     * @access    Private (Admin)
     */
    updateSiteConfig: async (req, res) => {
        try {
            const tenant = req.tenant;
            const updateData = req.body;

            const updatedConfig = await SiteConfig.findOneAndUpdate(
                { tenantId: tenant._id },
                {
                    $set: updateData,
                    $setOnInsert: {
                        tenantId: tenant._id,
                        subdomain: tenant.subdomain
                    }
                },
                {
                    new: true,
                    upsert: true,
                    runValidators: true
                }
            );

            res.status(200).json({
                message: "Site configuration updated successfully!",
                config: updatedConfig
            });

        } catch (error) {
            console.error('Error in updateSiteConfig:', error);
            res.status(500).json({
                message: 'Failed to update site configuration',
                error: error.message
            });
        }
    }
};

module.exports = { SiteConfigController };
