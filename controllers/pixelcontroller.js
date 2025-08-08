// controllers/siteConfigController.js

const PixelModel = require('../models/Pixel');
const SiteConfig = require('../models/SiteConfig'); // Assuming you have a SiteConfig model
const { validationResult, param } = require('express-validator');

// ==================================
// Pixel Handlers (Tenant-Aware)
// ==================================

const PixelController = {
    /**
     * @desc    Saves a new Facebook or TikTok pixel ID for the current tenant.
     * @route   POST /api/pixels
     * @access  Private (Admin) - Requires authentication to identify the tenant.
     */
    postPixel: async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { fbPixelId, tiktokPixelId } = req.body;
            // The tenantId is securely obtained from the authenticated user's session/token,
            // which is set by a protection middleware (e.g., 'protect').
            const tenantId = req.user.tenantId; 

            const newPixel = await PixelModel.createPixelForTenant({
                fbPixelId,
                tiktokPixelId,
                tenantId
            });

            res.status(201).json({
                message: 'Pixel IDs saved successfully!',
                pixel: newPixel
            });
        } catch (error) {
            console.error('Error saving pixel IDs:', error);
            res.status(error.statusCode || 500).json({ message: error.message || 'Failed to save pixel IDs.' });
        }
    },

    /**
     * @desc    Gets all saved pixel entries for the current tenant.
     * @route   GET /api/pixels
     * @access  Private (Admin)
     */
    getPixels: async (req, res) => {
        try {
            const tenantId = req.user.tenantId;
            const pixels = await PixelModel.getAllPixelsForTenant(tenantId);
            res.status(200).json({
                message: 'Successfully retrieved all pixel IDs!',
                pixels
            });
        } catch (error) {
            console.error('Error fetching pixel IDs:', error);
            res.status(500).json({ message: 'Failed to retrieve pixel IDs.' });
        }
    },

    /**
     * @desc    Deletes a specific pixel entry by its ID for the current tenant.
     * @route   DELETE /api/pixels/:id
     * @access  Private (Admin)
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
                const tenantId = req.user.tenantId;

                // The model logic ensures we only delete the pixel if it belongs to the current tenant.
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

// ======================================
// Site Config Handlers (Tenant-Aware)
// ======================================

const SiteConfigController = {
    /**
     * @desc    Provides the entire site configuration for the current tenant.
     * @route   GET /api/site-config
     * @access  Public - Tenant is identified via a public middleware (e.g., from subdomain).
     */
    getSiteConfig: async (req, res) => {
        try {
            // This `tenantId` is set by a middleware (like `identifyTenant`) that runs
            // before this controller, determining the tenant from the request's hostname.
            const tenantId = req.tenantId; 

            // Fetch the site settings and the latest pixel settings in parallel for efficiency.
            const [siteConfig, pixelConfig] = await Promise.all([
                SiteConfig.findOne({ tenantId }).lean(), // Fetch from your SiteConfig model
                PixelModel.getLatestPixelConfigForTenant(tenantId)
            ]);

            if (!siteConfig) {
                return res.status(404).json({ message: 'Site configuration not found for this client.' });
            }

            // Combine the data from the database with the pixel settings.
            const fullConfig = {
                ...siteConfig, // Includes site name, colors, delivery fees, etc.
                facebookPixelId: pixelConfig ? pixelConfig.facebookPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null,
            };

            res.status(200).json(fullConfig);
        } catch (error) {
            console.error('Error fetching site configuration:', error);
            res.status(500).json({ message: 'Failed to retrieve site configuration.' });
        }
    }
    // You can add PUT/POST handlers here to update the site configuration.
};

module.exports = { PixelController, SiteConfigController };
