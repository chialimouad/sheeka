const SiteConfig = require('../models/sitecontroll');

// @desc    Get site configuration
// @route   GET /api/site-config
// @access  Public (can be restricted for admin panel later)
exports.getSiteConfig = async (req, res) => {
    try {
        const config = await SiteConfig.getSingleton(); // Use the static method to get/create config
        res.json(config);
    } catch (error) {
        console.error('Error fetching site configuration:', error);
        res.status(500).json({ message: 'Server error fetching site configuration', error: error.message });
    }
};

// @desc    Update site configuration
// @route   PUT /api/site-config
// @access  Private (e.g., Admin only)
exports.updateSiteConfig = async (req, res) => {
    try {
        // Find the single configuration document. If none, getSingleton will create it first.
        let config = await SiteConfig.getSingleton(); 
        
        // Update fields from request body. Use defaults if not provided in request.
        // Ensure that socialMediaLinks is handled properly as an array
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
            socialMediaLinks 
        } = req.body;

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

        if (socialMediaLinks !== undefined) {
            if (Array.isArray(socialMediaLinks)) {
                // Validate each social media link object if necessary
                config.socialMediaLinks = socialMediaLinks.map(link => ({
                    platform: link.platform || '',
                    url: link.url || '',
                    iconClass: link.iconClass || ''
                }));
            } else {
                return res.status(400).json({ message: 'socialMediaLinks must be an array.' });
            }
        }

        await config.save();
        res.json({ message: 'Site configuration updated successfully', config });
    } catch (error) {
        console.error('Error updating site configuration:', error);
        res.status(500).json({ message: 'Server error updating site configuration', error: error.message });
    }
};
