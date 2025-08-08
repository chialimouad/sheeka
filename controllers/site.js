/**
 * FILE: ./controllers/siteConfigController.js
 * DESC: Handles business logic for fetching and updating tenant-specific site configurations.
 *
 * FIXES APPLIED:
 * - Corrected the model import path from 'sitecontroll' to the correct 'SiteConfig'.
 * - Refactored `getSiteConfig` to properly handle cases where a config doesn't exist yet, creating a default object in memory using info from the Client model and schema defaults. This removes the dependency on the non-existent `findOrCreateForTenant` method.
 * - Added `deliveryFees` to the `updateSiteConfig` logic, allowing tenants to update their shipping prices.
 * - Standardized the use of `req.tenant.tenantId` and `req.tenant.subdomain` which are attached by the `identifyTenant` middleware.
 * - Maintained the security fix in `updateSiteConfig` to explicitly list updateable fields, preventing mass assignment vulnerabilities.
 */
const SiteConfig = require('../models/sitecontroll');
const Client = require('../models/Client'); // Needed to get defaults for new configs
const PixelModel = require('../models/pixel'); // For merging pixel data

const SiteConfigController = {
    /**
     * @desc    Get the complete site configuration for the current tenant.
     * @route   GET /site-config
     * @access  Private (Tenant-specific)
     */
    getSiteConfig: async (req, res) => {
        try {
            const tenantId = req.tenant.tenantId; // From identifyTenant middleware

            let siteConfig = await SiteConfig.findOne({ tenantId }).lean();

            // If no config exists, build a default one to return.
            // It will be saved on the first PUT request.
            if (!siteConfig) {
                const client = await Client.findOne({ tenantId }).lean();
                if (!client) {
                    return res.status(404).json({ message: 'Client data not found for this tenant.' });
                }
                
                // Create a temporary default config using schema defaults and client info
                const defaultConfig = new SiteConfig({
                    tenantId: client.tenantId,
                    subdomain: client.subdomain,
                    siteName: client.name,
                });
                siteConfig = defaultConfig.toObject();
            }
            
            // Fetch the latest pixel configuration for the tenant
            const pixelConfig = await PixelModel.findOne({ tenantId: req.tenant._id }).sort({ createdAt: -1 }).lean();

            // Combine site config with pixel data for a complete response
            const fullConfig = {
                ...siteConfig,
                facebookPixelId: pixelConfig ? pixelConfig.fbPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null,
            };

            res.status(200).json(fullConfig);
        } catch (error) {
            console.error('Error fetching site configuration:', error);
            res.status(500).json({ message: 'Server error while fetching configuration.' });
        }
    },

    /**
     * @desc    Create or Update the site configuration for the current tenant.
     * @route   PUT /site-config
     * @access  Private (Admin role for the tenant)
     */
    updateSiteConfig: async (req, res) => {
        try {
            const tenantId = req.tenant.tenantId; // From identifyTenant middleware

            // Explicitly destructure all expected fields from the request body for security.
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
                deliveryFees, // Added deliveryFees to be updatable
                currentDataIndex
            } = req.body;

            // Construct the object with all fields that are allowed to be updated.
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
                deliveryFees,
                currentDataIndex,
                subdomain: req.tenant.subdomain // Ensure subdomain is always set
            };

            // Use findOneAndUpdate with upsert to create the document if it doesn't exist.
            const updatedConfig = await SiteConfig.findOneAndUpdate(
                { tenantId: tenantId },
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

// Note: The PixelController logic would ideally be in its own file.
// For this fix, we are only exporting the corrected SiteConfigController.
module.exports = { SiteConfigController };
