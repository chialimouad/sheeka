const SiteConfig = require('../models/sitecontroll'); // Corrected model import name
const { validationResult } = require('express-validator'); // Import validationResult

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// @desc    Get site configuration
// @route   GET /api/site-config
// @access  Public (can be restricted for admin panel later)
exports.getSiteConfig = async (req, res) => {
    try {
        // Use the static method to get/create config.
        // This ensures a single configuration document exists.
        const config = await SiteConfig.getSingleton(); 
        res.status(200).json(config); // Use 200 for successful retrieval
    } catch (error) {
        console.error('Error fetching site configuration:', error.message);
        // Provide a generic error message to the client for security
        res.status(500).json({ message: 'Server error fetching site configuration. Please try again later.' });
    }
};

// @desc    Update site configuration
// @route   PUT /api/site-config
// @access  Private (e.g., Admin only) - Requires authentication and authorization middleware
exports.updateSiteConfig = async (req, res) => {
    // --- Authorization Check (Placeholder) ---
    // IMPORTANT: You must implement actual authentication and authorization middleware
    // before this controller. For example:
    // if (!req.user || !req.user.isAdmin) {
    //     return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    // }
    // ------------------------------------------

    // Validation errors are handled by the middleware chain before this function
    handleValidationErrors(req, res, async () => {
        try {
            // Get the singleton configuration document. 
            // getSingleton ensures it exists or creates it with defaults.
            let config = await SiteConfig.getSingleton(); 
            
            // Destructure the request body for cleaner code
            const { 
                siteName, 
                slogan, 
                primaryColor, 
                secondaryColor, 
                tertiaryColor, 
                generalTextColor, 
                footerBgColor, 
                footerTextColor, 
                footerLinkColor, 
                aboutUsText, 
                aboutUsImageUrl,
                socialMediaLinks,
                deliveryFees,
                currentDataIndex 
            } = req.body;

            // Update fields only if they are provided in the request body
            if (siteName !== undefined) config.siteName = siteName;
            if (slogan !== undefined) config.slogan = slogan;
            if (primaryColor !== undefined) config.primaryColor = primaryColor;
            if (secondaryColor !== undefined) config.secondaryColor = secondaryColor;
            if (tertiaryColor !== undefined) config.tertiaryColor = tertiaryColor;
            if (generalTextColor !== undefined) config.generalTextColor = generalTextColor;
            if (footerBgColor !== undefined) config.footerBgColor = footerBgColor;
            if (footerTextColor !== undefined) config.footerTextColor = footerTextColor;
            if (footerLinkColor !== undefined) config.footerLinkColor = footerLinkColor;
            if (aboutUsText !== undefined) config.aboutUsText = aboutUsText;
            if (aboutUsImageUrl !== undefined) config.aboutUsImageUrl = aboutUsImageUrl;

            // Social media links are validated by express-validator, 
            // so we can directly assign if present.
            if (socialMediaLinks !== undefined) {
                config.socialMediaLinks = socialMediaLinks.map(link => ({
                    platform: link.platform || '',
                    url: link.url || '',
                    iconClass: link.iconClass || ''
                }));
            }

            // Delivery fees are validated by express-validator, 
            // so we can directly assign if present.
            if (deliveryFees !== undefined) {
                // Sort fees by wilayaId for consistent order if desired
                config.deliveryFees = deliveryFees.sort((a, b) => a.wilayaId - b.wilayaId);
            }

            // currentDataIndex is validated by express-validator, 
            // so we can directly assign if present.
            if (currentDataIndex !== undefined) {
                config.currentDataIndex = currentDataIndex;
            }

            // Save the updated configuration to the database
            await config.save();
            res.status(200).json({ message: 'Site configuration updated successfully', config });
        } catch (error) {
            console.error('Error updating site configuration:', error.message);
            res.status(500).json({ message: 'Server error updating site configuration. Please try again later.' });
        }
    });
};

// @desc    Update only the currentDataIndex field of site configuration
// @route   PUT /api/site-config/index
// @access  Private (e.g., Admin only) - Requires authentication and authorization middleware
exports.updateCurrentDataIndex = async (req, res) => {
    // --- Authorization Check (Placeholder) ---
    // IMPORTANT: You must implement actual authentication and authorization middleware
    // before this controller. For example:
    // if (!req.user || !req.user.isAdmin) {
    //     return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    // }
    // ------------------------------------------

    // Validation errors are handled by the middleware chain before this function
    handleValidationErrors(req, res, async () => {
        try {
            let config = await SiteConfig.getSingleton(); 
            const { currentDataIndex } = req.body;

            // currentDataIndex is guaranteed to be a number by validation middleware
            config.currentDataIndex = currentDataIndex;

            await config.save();
            res.status(200).json({ message: 'Current data index updated successfully', config: { currentDataIndex: config.currentDataIndex } });
        } catch (error) {
            console.error('Error updating current data index:', error.message);
            res.status(500).json({ message: 'Server error updating current data index. Please try again later.' });
        }
    });
};
