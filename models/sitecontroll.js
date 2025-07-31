// models/SiteConfig.js

const mongoose = require('mongoose');

// Helper function to generate default Algerian wilayas and their default fees
const generateDefaultDeliveryFees = () => {
    return [
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
        { "wilayaId": 53, "wilayaName": "In Guezzam", "price": 1250 },
        { "wilayaId": 54, "wilayaName": "Touggourt", "price": 990 },
        { "wilayaId": 55, "wilayaName": "Djanet", "price": 1400 },
        { "wilayaId": 56, "wilayaName": "El M'Ghair", "price": 970 },
        { "wilayaId": 57, "wilayaName": "El Meniaa", "price": 1150 },
        { "wilayaId": 58, "wilayaName": "In Salah", "price": 1300 }
    ];
};

const SiteConfigSchema = new mongoose.Schema({
    // This tenantId field is the cornerstone of the multi-tenant architecture.
    // It must be unique, as each client has only one site configuration.
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Client',
        unique: true,
        index: true,
    },
    siteName: { type: String, default: 'My Store' },
    slogan: { type: String, default: 'Quality products you can trust.' },
    primaryColor: { type: String, default: '#C8797D' },
    secondaryColor: { type: String, default: '#A85F64' },
    tertiaryColor: { type: String, default: '#FDF5E6' },
    generalTextColor: { type: String, default: '#4A4A4A' },
    footerBgColor: { type: String, default: '#4A4A4A' },
    footerTextColor: { type: String, default: '#DDCACA' },
    footerLinkColor: { type: String, default: '#E6B89C' },
    aboutUsText: { type: String, default: 'Welcome to our store!' },
    aboutUsImageUrl: { type: String, default: 'https://placehold.co/800x600/cccccc/FFFFFF?text=About+Us' },
    socialMediaLinks: [{
        platform: { type: String, required: true },
        url: { type: String, required: true },
        iconClass: { type: String, required: true }
    }],
    deliveryFees: [{
        wilayaId: { type: Number, required: true },
        wilayaName: { type: String, required: true },
        price: { type: Number, required: true, default: 0 }
    }],
    currentDataIndex: { type: Number, default: 0 }
}, {
    timestamps: true
});

/**
 * @description Finds the configuration for a given tenant. If it doesn't exist,
 * it creates a new one with default values.
 * @param {string} tenantId The ID of the tenant.
 * @returns {Promise<Document>} The site configuration document.
 */
SiteConfigSchema.statics.findOrCreateForTenant = async function(tenantId) {
    let config = await this.findOne({ tenantId });
    if (!config) {
        config = await this.create({
            tenantId,
            deliveryFees: generateDefaultDeliveryFees(), // Initialize with default fees
            socialMediaLinks: [
                { platform: 'Facebook', url: '#', iconClass: 'fab fa-facebook-f' },
                { platform: 'Instagram', url: '#', iconClass: 'fab fa-instagram' },
                { platform: 'Twitter', url: '#', iconClass: 'fab fa-twitter' }
            ],
        });
    }
    return config;
};

module.exports = mongoose.model('SiteConfig', SiteConfigSchema);
