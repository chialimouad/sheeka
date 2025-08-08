/**
 * FILE: ./controllers/siteConfigController.js
 * DESC: Controller for managing the main site configuration.
 *
 * UPDATE: Added a new `getPublicSiteConfig` function. This function is called
 * by a new, unprotected public route. It fetches the necessary site configuration
 * for the public-facing website without requiring admin authentication, resolving
 * the 401 Unauthorized error on the main site.
 */
const SiteConfig = require('../models/sitecontroll');
const PixelModel = require('../models/pixel');
const { validationResult } = require('express-validator');

const SiteConfigController = {
    /**
     * @desc     Provides the public site configuration for the current tenant.
     * @route    GET /site-config/public
     * @access   Public
     */
    getPublicSiteConfig: async (req, res) => {
        try {
            // The tenant's MongoDB ObjectId is attached by the identifyTenant middleware.
            const tenantObjectId = req.tenant._id;

            const siteConfig = await SiteConfig.findOne({ tenantId: tenantObjectId }).lean();

            if (!siteConfig) {
                return res.status(404).json({ message: 'Site configuration not found.' });
            }

            res.status(200).json(siteConfig);
        } catch (error) {
            console.error('Error in getPublicSiteConfig:', error);
            res.status(500).json({
                message: 'Failed to retrieve public site configuration.',
                error: error.message
            });
        }
    },

    /**
     * @desc     Provides the entire site configuration for the current tenant (Admin).
     * @route    GET /site-config
     * @access   Private (Admin)
     */
    getSiteConfig: async (req, res) => {
        try {
            const tenantObjectId = req.tenant._id;
            const [siteConfig, pixelConfig] = await Promise.all([
                SiteConfig.findOne({ tenantId: tenantObjectId }).lean(),
                PixelModel.findOne({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean()
            ]);

            if (!siteConfig) {
                return res.status(404).json({
                    message: 'Site configuration not yet created. Please save your settings to initialize it.',
                    subdomain: req.tenant.subdomain
                });
            }

            const fullConfig = {
                ...siteConfig,
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
     * @desc     Updates or creates the main site configuration for the current tenant.
     * @route    PUT /site-config
     * @access   Private (Admin)
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
