const mongoose = require('mongoose');

const SiteConfigSchema = new mongoose.Schema({
    // General site information
    siteName: {
        type: String,
        required: true,
        default: ''
    },
    slogan: {
        type: String,
        required: true,
        default: ''
    },
    // Main brand colors (using hex codes for flexibility, can be mapped to Tailwind classes in frontend)
    primaryColor: { // Used for main accents, like buttons, active states
        type: String,
        default: '#C8797D' // Example: Sheeka's accent pink/red
    },
    secondaryColor: { // Used for darker accents, hover states
        type: String,
        default: '#A85F64' // Example: Darker Sheeka pink/red
    },
    tertiaryColor: { // Used for creamy background elements
        type: String,
        default: '#FDF5E6' // Example: Creamy off-white
    },
    generalTextColor: { // Used for main body text
        type: String,
        default: '#4A4A4A' // Example: Dark charcoal
    },
    // Footer specific styles
    footerBgColor: {
        type: String,
        default: '#4A4A4A' // Example: Dark charcoal for footer background
    },
    footerTextColor: {
        type: String,
        default: '#DDCACA' // Example: Lighter grey for footer text
    },
    footerLinkColor: {
        type: String,
        default: '#E6B89C' // Example: Light brown for footer links
    },
    // About Us section content
    aboutUsText: {
        type: String,
        required: true,
        default: `At , we believe that fashion is a powerful form of self-expression. Our brand is dedicated to providing high-quality, stylish, and comfortable clothing that empowers you to express your unique personality.

From conceptualization to creation, every piece is crafted with meticulous attention to detail and a passion for design. We're committed to sustainable practices and ethical production, ensuring that your style choices make a positive impact. Join the Sheeka family and redefine your wardrobe.`
    },
    aboutUsImageUrl: { // New field for About Us image
        type: String,
        default: 'https://placehold.co/800x600/F020D8/FFFFFF?text=About+Us'
    },
    // Social Media Links (flexible array for multiple links)
    socialMediaLinks: [
        {
            platform: { // e.g., 'Facebook', 'Instagram', 'Twitter'
                type: String,
                required: true
            },
            url: {
                type: String,
                required: true
            },
            iconClass: { // e.g., 'fab fa-facebook-f', 'fab fa-instagram', 'fab fa-twitter'
                type: String,
                required: true
            }
        }
    ],
    // Delivery Fees - Will now be managed entirely from the database
    deliveryFees: [
        {
            wilayaId: {
                type: Number,
                required: true
            },
            wilayaName: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true,
                default: 0
            }
        }
    ],
    // NEW FIELD: A generic number data field
    currentDataIndex: {
        type: Number,
        default: 0 // Default value
    }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});


/**
 * getSingleton Method
 * Ensures that there is always one and only one site configuration document.
 * If no configuration exists, it creates a new one with empty defaults for dynamic content like deliveryFees.
 */
SiteConfigSchema.statics.getSingleton = async function() {
    let config = await this.findOne();
    if (!config) {
        // Create a default configuration if none exists.
        // Delivery fees are initialized as an empty array, to be populated from the admin panel.
        config = await this.create({
            siteName: '',
            slogan: '',
            primaryColor: '#C8797D',
            secondaryColor: '#A85F64',
            tertiaryColor: '#FDF5E6',
            generalTextColor: '#4A4A4A',
            footerBgColor: '#4A4A4A',
            footerTextColor: '#DDCACA',
            footerLinkColor: '#E6B89C',
            aboutUsText: `At , we believe that fashion is a powerful form of self-expression. Our brand is dedicated to providing high-quality, stylish, and comfortable clothing that empowers you to express your unique personality.

From conceptualization to creation, every piece is crafted with meticulous attention to detail and a passion for design. We're committed to sustainable practices and ethical production, ensuring that your style choices make a positive impact. Join the Sheeka family and redefine your wardrobe.`,
            aboutUsImageUrl: 'https://placehold.co/800x600/F020D8/FFFFFF?text=About+Us',
            socialMediaLinks: [
                { platform: 'Facebook', url: '#', iconClass: 'fab fa-facebook-f' },
                { platform: 'Instagram', url: '#', iconClass: 'fab fa-instagram' },
                { platform: 'Twitter', url: '#', iconClass: 'fab fa-twitter' }
            ],
            deliveryFees: [], // Initialize with an empty array
            currentDataIndex: 0
        });
    } else {
        let changed = false;
        // Ensure that existing configs have the deliveryFees field.
        if (!config.deliveryFees) {
            config.deliveryFees = [];
            changed = true;
        }

        // Ensure currentDataIndex exists on existing configurations
        if (config.currentDataIndex === undefined) {
            config.currentDataIndex = 0;
            changed = true;
        }

        if (changed) {
            await config.save();
        }
    }
    return config;
};

module.exports = mongoose.model('SiteConfig', SiteConfigSchema);
