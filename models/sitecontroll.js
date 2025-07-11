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
    // Delivery Fees
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

// Helper function to generate default Algerian wilayas and their default fees
const generateDefaultDeliveryFees = () => {
    const defaultFees = [
        { "wilayaId": 1, "wilayaName": "Adrar", "price": 800 },
        { "wilayaId": 2, "wilayaName": "Chlef", "price": 650 },
        { "wilayaId": 3, "wilayaName": "Laghouat", "price": 700 },
        { "wilayaId": 4, "wilayaName": "Oum El Bouaghi", "price": 750 },
        { "wilayaId": 5, "wilayaName": "Batna", "price": 600 },
        { "wilayaId": 6, "wilayaName": "Béjaïa", "price": 550 },
        { "wilayaId": 7, "wilayaName": "Biskra", "price": 680 },
        { "wilayaId": 8, "wilayaName": "Béchar", "price": 900 },
        { "wilayaId": 9, "wilayaName": "Blida", "price": 520 },
        { "wilayaId": 10, "wilayaName": "Bouira", "price": 530 },
        { "wilayaId": 11, "wilayaName": "Tamanrasset", "price": 1200 },
        { "wilayaId": 12, "wilayaName": "Tébessa", "price": 720 },
        { "wilayaId": 13, "wilayaName": "Tlemcen", "price": 650 },
        { "wilayaId": 14, "wilayaName": "Tiaret", "price": 680 },
        { "wilayaId": 15, "wilayaName": "Tizi Ouzou", "price": 580 },
        { "wilayaId": 16, "wilayaName": "Alger", "price": 500 },
        { "wilayaId": 17, "wilayaName": "Djelfa", "price": 710 },
        { "wilayaId": 18, "wilayaName": "Jijel", "price": 630 },
        { "wilayaId": 19, "wilayaName": "Sétif", "price": 570 },
        { "wilayaId": 20, "wilayaName": "Saïda", "price": 850 },
        { "wilayaId": 21, "wilayaName": "Skikda", "price": 620 },
        { "wilayaId": 22, "wilayaName": "Sidi Bel Abbès", "price": 700 },
        { "wilayaId": 23, "wilayaName": "Annaba", "price": 590 },
        { "wilayaId": 24, "wilayaName": "Guelma", "price": 610 },
        { "wilayaId": 25, "wilayaName": "Constantine", "price": 560 },
        { "wilayaId": 26, "wilayaName": "Médéa", "price": 540 },
        { "wilayaId": 27, "wilayaName": "Mostaganem", "price": 600 },
        { "wilayaId": 28, "wilayaName": "M'Sila", "price": 690 },
        { "wilayaId": 29, "wilayaName": "Mascara", "price": 670 },
        { "wilayaId": 30, "wilayaName": "Ouargla", "price": 950 },
        { "wilayaId": 31, "wilayaName": "Oran", "price": 600 },
        { "wilayaId": 32, "wilayaName": "El Bayadh", "price": 880 },
        { "wilayaId": 33, "wilayaName": "Illizi", "price": 1500 },
        { "wilayaId": 34, "wilayaName": "Bordj Bou Arréridj", "price": 550 },
        { "wilayaId": 35, "wilayaName": "Boumerdès", "price": 510 },
        { "wilayaId": 36, "wilayaName": "El Tarf", "price": 600 },
        { "wilayaId": 37, "wilayaName": "Tindouf", "price": 1800 },
        { "wilayaId": 38, "wilayaName": "Tissemsilt", "price": 670 },
        { "wilayaId": 39, "wilayaName": "El Oued", "price": 920 },
        { "wilayaId": 40, "wilayaName": "Khenchela", "price": 730 },
        { "wilayaId": 41, "wilayaName": "Souk Ahras", "price": 640 },
        { "wilayaId": 42, "wilayaName": "Tipaza", "price": 520 },
        { "wilayaId": 43, "wilayaName": "Mila", "price": 580 },
        { "wilayaId": 44, "wilayaName": "Aïn Defla", "price": 530 },
        { "wilayaId": 45, "wilayaName": "Naâma", "price": 820 },
        { "wilayaId": 46, "wilayaName": "Aïn Témouchent", "price": 660 },
        { "wilayaId": 47, "wilayaName": "Ghardaïa", "price": 780 },
        { "wilayaId": 48, "wilayaName": "Relizane", "price": 690 },
        { "wilayaId": 49, "wilayaName": "Timimoun", "price": 1000 },
        { "wilayaId": 50, "wilayaName": "Bordj Badji Mokhtar", "price": 1100 },
        { "wilayaId": 51, "wilayaName": "Ouled Djellal", "price": 980 },
        { "wilayaId": 52, "wilayaName": "Béni Abbès", "price": 1050 },
        { "wilayaId": 53, "wilayaName": "Timimoun", "price": 1000 }, // Corrected ID to match name, though it's a duplicate entry in original source
        { "wilayaId": 54, "wilayaName": "Touggourt", "price": 990 },
        { "wilayaId": 55, "wilayaName": "Djanet", "price": 1400 },
        { "wilayaId": 56, "wilayaName": "El M'Ghair", "price": 970 },
        { "wilayaId": 57, "wilayaName": "El Meniaa", "price": 1150 },
        { "wilayaId": 58, "wilayaName": "In Salah", "price": 1300 }
    ];

    return defaultFees;
};

SiteConfigSchema.statics.getSingleton = async function() {
    let config = await this.findOne();
    if (!config) {
        // Create a default configuration if none exists
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
            deliveryFees: generateDefaultDeliveryFees(), // Initialize with default fees
            currentDataIndex: 0 // NEW: Initialize currentDataIndex
        });
    } else {
        // Ensure that existing configs have the deliveryFees field.
        // If not, initialize it with defaults or merge.
        let changed = false;
        if (!config.deliveryFees || config.deliveryFees.length === 0) {
            config.deliveryFees = generateDefaultDeliveryFees();
            changed = true;
        } else {
            // Optional: If you want to ensure all 58 wilayas are always present,
            // you could iterate through `generateDefaultDeliveryFees()` and add
            // any missing wilayas to `config.deliveryFees`.
            const existingWilayaIds = new Set(config.deliveryFees.map(f => f.wilayaId));
            const defaultFeesList = generateDefaultDeliveryFees();
            defaultFeesList.forEach(defaultFee => {
                if (!existingWilayaIds.has(defaultFee.wilayaId)) {
                    config.deliveryFees.push(defaultFee);
                    changed = true;
                }
            });
        }

        // NEW: Ensure currentDataIndex exists on existing configurations
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
