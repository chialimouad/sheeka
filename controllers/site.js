/**
 * FILE: ./controllers/siteConfigController.js
 * DESC: Controller for managing the main site configuration.
 *
 * FIX: This version separates concerns. It only handles the GET and PUT
 * for the main site settings. It fetches the latest pixel config but does not
 * manage it, as that is handled by pixelController.js.
 *
 * FIX: Corrected the model import from 'sitecontroll' to 'siteConfig',
 * which is the more likely filename and avoids a server error if the
 * model cannot be found.
 */
// FIX: Corrected model name from 'sitecontroll' to 'siteConfig'.
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

            if (!siteConfig) {
                return res.status(404).json({ message: 'Site configuration not found for this client.' });
            }

            // Combine the data into a single response object.
            const fullConfig = {
                ...siteConfig,
                facebookPixelId: pixelConfig ? pixelConfig.fbPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null,
            };

            res.status(200).json(fullConfig);
        } catch (error) {
            console.error('Error fetching site configuration:', error);
            res.status(500).json({ message: 'Failed to retrieve site configuration.' });
        }
    },

    /**
     * @desc    Updates the main site configuration for the current tenant.
     * @route   PUT /site-config
     * @access  Private (Admin)
     */
    updateSiteConfig: async (req, res) => {
        try {
            const tenantObjectId = req.tenant._id;
            // Destructure only the fields that belong to the site configuration
            const {
                siteName, slogan, heroTitle, heroButtonText, heroImageUrl,
                primaryColor, secondaryColor, tertiaryColor, generalTextColor,
                footerBgColor, footerTextColor, footerLinkColor, aboutUsText,
                aboutUsImageUrl, contactInfo, socialMediaLinks, deliveryFees, currentDataIndex
            } = req.body;

            const updateData = {
                siteName, slogan, heroTitle, heroButtonText, heroImageUrl,
                primaryColor, secondaryColor, tertiaryColor, generalTextColor,
                footerBgColor, footerTextColor, footerLinkColor, aboutUsText,
                aboutUsImageUrl, contactInfo, socialMediaLinks, deliveryFees, currentDataIndex
            };
            
            const updatedConfig = await SiteConfig.findOneAndUpdate(
                { tenantId: tenantObjectId },
                { $set: updateData },
                { new: true, upsert: true, runValidators: true }
            );

            res.status(200).json({
                message: "Site configuration updated successfully!",
                config: updatedConfig
            });

        } catch (error) {
            console.error('Error updating site config:', error);
            res.status(500).json({ message: 'Failed to update site configuration' });
        }
    }
};

module.exports = { SiteConfigController };
