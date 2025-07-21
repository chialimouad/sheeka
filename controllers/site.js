const SiteConfig = require('../models/sitecontroll'); // Assuming the model is in ../models/SiteConfig.js

// @desc    Get the singleton site configuration
// @route   GET /api/site-config
// @access  Public
exports.getSiteConfig = async (req, res) => {
    try {
        // The getSingleton static method in your model will find the existing
        // config or create a default one if it doesn't exist.
        const config = await SiteConfig.getSingleton();
        res.json(config);
    } catch (err) {
        console.error('Error in getSiteConfig:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Update the entire site configuration
// @route   PUT /api/site-config
// @access  Private (Admin)
// This is the function that will allow you to "upload" new delivery fees.
exports.updateSiteConfig = async (req, res) => {
    try {
        // Fetch the one and only config document
        const config = await SiteConfig.getSingleton();

        if (!config) {
            return res.status(404).json({ msg: 'Site configuration not found.' });
        }

        // The request body should contain the full configuration object,
        // including the updated deliveryFees array.
        const updates = req.body;

        // Update all fields based on the request body.
        // This will replace the old deliveryFees array with the new one from the request.
        config.siteName = updates.siteName || config.siteName;
        config.slogan = updates.slogan || config.slogan;
        config.primaryColor = updates.primaryColor || config.primaryColor;
        config.secondaryColor = updates.secondaryColor || config.secondaryColor;
        config.tertiaryColor = updates.tertiaryColor || config.tertiaryColor;
        config.generalTextColor = updates.generalTextColor || config.generalTextColor;
        config.footerBgColor = updates.footerBgColor || config.footerBgColor;
        config.footerTextColor = updates.footerTextColor || config.footerTextColor;
        config.footerLinkColor = updates.footerLinkColor || config.footerLinkColor;
        config.aboutUsText = updates.aboutUsText || config.aboutUsText;
        config.aboutUsImageUrl = updates.aboutUsImageUrl || config.aboutUsImageUrl;
        config.socialMediaLinks = updates.socialMediaLinks || config.socialMediaLinks;
        config.deliveryFees = updates.deliveryFees || config.deliveryFees; // <-- This is the key line for your issue
        config.currentDataIndex = updates.currentDataIndex !== undefined ? updates.currentDataIndex : config.currentDataIndex;


        // Save the updated configuration to the database
        const updatedConfig = await config.save();

        // Send the newly updated configuration back as a response
        res.json(updatedConfig);

    } catch (err) {
        console.error('Error in updateSiteConfig:', err.message);
        res.status(500).send('Server Error');
    }
};


// @desc    Update only the currentDataIndex field
// @route   PUT /api/site-config/index
// @access  Private (Admin)
exports.updateCurrentDataIndex = async (req, res) => {
    try {
        const { currentDataIndex } = req.body;

        if (currentDataIndex === undefined) {
            return res.status(400).json({ msg: 'currentDataIndex is required.' });
        }

        const config = await SiteConfig.getSingleton();

        if (!config) {
            return res.status(404).json({ msg: 'Site configuration not found.' });
        }

        config.currentDataIndex = currentDataIndex;

        const updatedConfig = await config.save();
        res.json(updatedConfig);

    } catch (err) {
        console.error('Error in updateCurrentDataIndex:', err.message);
        res.status(500).send('Server Error');
    }
};
