/**
 * @fileoverview Handles API logic for pixel ID management and site configuration.
 */

const PixelModel = require('../models/pixel'); // This path must be correct!
const mongoose = require('mongoose'); // Import mongoose to validate ObjectId

const PixelController = {
    /**
     * @desc Handles POST requests to store new Facebook or TikTok pixel IDs.
     * @route POST /api/pixels
     * @access Private (should be protected with authentication/authorization)
     * @param {object} req - Express request object.
     * @param {object} res - Express response object.
     */
    postPixel: async (req, res) => {
        // Trim whitespace from input IDs for cleaner data
        const fbPixelId = req.body.fbPixelId ? String(req.body.fbPixelId).trim() : null;
        const tiktokPixelId = req.body.tiktokPixelId ? String(req.body.tiktokPixelId).trim() : null;

        // Validate that at least one pixel ID is provided and is not an empty string after trimming
        if (!fbPixelId && !tiktokPixelId) {
            return res.status(400).json({
                message: 'At least one of fbPixelId or tiktokPixelId is required and cannot be empty.'
            });
        }

        // Optional: Add more specific format validation if pixel IDs follow a pattern (e.g., numeric only)
        // if (fbPixelId && !/^\d+$/.test(fbPixelId)) {
        //     return res.status(400).json({ message: 'Facebook Pixel ID must be numeric.' });
        // }
        // if (tiktokPixelId && !/^\d+$/.test(tiktokPixelId)) {
        //     return res.status(400).json({ message: 'TikTok Pixel ID must be numeric.' });
        // }

        try {
            // Calling the static method directly on the imported Model
            // Assuming createPixel handles upsert logic or creates a new entry.
            const newPixel = await PixelModel.createPixel({ fbPixelId, tiktokPixelId });
            res.status(201).json({
                message: 'Pixel IDs stored successfully!',
                pixel: newPixel
            });
        } catch (error) {
            // Handle duplicate key error (if 'unique: true' is added to schema fields)
            if (error.code === 11000) {
                console.error('Duplicate pixel ID error:', error.message);
                return res.status(409).json({
                    message: 'A pixel entry with one of the provided IDs already exists. Please use unique IDs or update the existing entry.',
                    // Avoid exposing raw error message to client in production
                });
            }
            // Handle custom errors from model (e.g., the 'statusCode' from createPixel)
            if (error.statusCode) {
                console.error('Custom pixel creation error:', error.message);
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error('Error saving pixel IDs:', error.message);
            // Provide a generic error message to the client for security
            res.status(500).json({ message: 'Failed to save pixel IDs. Please try again.' });
        }
    },

    /**
     * @desc Handles GET requests to fetch all stored pixel entries.
     * @route GET /api/pixels
     * @access Private (should be protected with authentication/authorization)
     * @param {object} req - Express request object.
     * @param {object} res - Express response object.
     */
    getPixels: async (req, res) => {
        try {
            // Calling the static method directly on the imported Model
            // Assuming getAllPixels fetches all records. For large datasets, consider pagination.
            const pixels = await PixelModel.getAllPixels();
            res.status(200).json({
                message: 'Fetched all pixel IDs successfully!',
                pixels
            });
        } catch (error) {
            console.error('Error fetching pixel IDs:', error.message);
            // Provide a generic error message to the client for security
            res.status(500).json({ message: 'Failed to fetch pixel IDs. Please try again.' });
        }
    },

    /**
     * @desc Handles DELETE requests to remove a specific pixel entry by ID.
     * @route DELETE /api/pixels/:id
     * @access Private (should be protected with authentication/authorization)
     * @param {object} req - Express request object (expects pixel ID in params).
     * @param {object} res - Express response object.
     */
    deletePixel: async (req, res) => {
        const pixelId = req.params.id; // Get the pixel ID from the URL parameters

        // Validate if the provided ID is a valid Mongoose ObjectId format
        if (!mongoose.Types.ObjectId.isValid(pixelId)) {
            return res.status(400).json({ message: 'Invalid pixel ID format.' });
        }

        try {
            // Calling the static method directly on the imported Model
            const deletedPixel = await PixelModel.deletePixel(pixelId);

            if (!deletedPixel) {
                return res.status(404).json({ message: 'Pixel ID not found or already deleted.' });
            }

            res.status(200).json({
                message: 'Pixel ID deleted successfully!',
                pixel: deletedPixel
            });
        } catch (error) {
            console.error('Error deleting pixel ID:', error.message);
            // Provide a generic error message to the client for security
            res.status(500).json({ message: 'Failed to delete pixel ID. Please try again.' });
        }
    },

    /**
     * @desc Handles GET requests to provide overall site configuration,
     * including active Facebook and TikTok pixel IDs and delivery fees.
     * This is designed to be the endpoint consumed by the frontend's fetchSiteConfig function.
     * @route GET /api/site-config
     * @access Public (can be public as it provides configuration data)
     * @param {object} req - Express request object.
     * @param {object} res - Express response object.
     */
    getSiteConfig: async (req, res) => {
        try {
            // Correct: Calling the static method directly on the imported Model
            // Assuming getLatestPixelConfig fetches the most recent or active pixel configuration.
            const pixelConfig = await PixelModel.getLatestPixelConfig();

            // Simulated other site configuration data
            // In a real application, these might also come from a database (e.g., a 'SiteConfig' model)
            // or environment variables, allowing dynamic updates without code changes.
            const siteConfigData = {
                siteName: "Sheeka Store",
                slogan: "Where Fashion Meets Comfort",
                aboutUsText: `At Sheeka Store, we believe that fashion is a powerful form of self-expression. Our brand is dedicated to providing high-quality, stylish, and comfortable clothing that empowers you to express your unique personality.

From conceptualization to creation, every piece is crafted with meticulous attention to detail and a passion for design. We're committed to sustainable practices and ethical production, ensuring that your style choices make a positive impact. Join the Sheeka family and redefine your wardrobe.`,
                aboutUsImageUrl: "/images/about_us_placeholder.jpg",
                metaDescription: "متجر Sheeka الإلكتروني يوفر أجود المنتجات بأسعار تنافسية.",
                primaryColor: "#C8797D",
                secondaryColor: "#A85F64",
                tertiaryColor: "#FDF5E6",
                generalTextColor: "#4A4A4A",
                footerBgColor: "#4A4A4A",
                footerTextColor: "#DDCACA",
                footerLinkColor: "#E6B89C",
                socialMediaLinks: [
                    { "platform": "facebook", "url": "https://facebook.com/sheeka", "iconClass": "fab fa-facebook-f" },
                    { "platform": "instagram", "url": "https://instagram.com/sheeka", "iconClass": "fab fa-instagram" },
                    { "platform": "twitter", "url": "https://twitter.com/sheeka", "iconClass": "fab fa-twitter" },
                    { "platform": "linkedin", "url": "https://linkedin.com/company/sheeka", "iconClass": "fab fa-linkedin-in" }
                ],
                promoImages: [
                    "/images/hero_image1.jpg",
                    "/images/hero_image2.jpg",
                    "/images/hero_image3.jpg"
                ],
                deliveryFees: [
                    { "wilayaId": 1, "wilayaName": "Adrar", "price": 700 },
                    { "wilayaId": 2, "wilayaName": "Chlef", "price": 650 },
                    { "wilayaId": 3, "wilayaName": "Laghouat", "price": 750 },
                    { "wilayaId": 4, "wilayaName": "Oum El Bouaghi", "price": 600 },
                    { "wilayaId": 5, "wilayaName": "Batna", "price": 550 },
                    { "wilayaId": 6, "wilayaName": "Béjaïa", "price": 500 },
                    { "wilayaId": 7, "wilayaName": "Biskra", "price": 700 },
                    { "wilayaId": 8, "wilayaName": "Béchar", "price": 900 },
                    { "wilayaId": 9, "wilayaName": "Blida", "price": 400 },
                    { "wilayaId": 10, "wilayaName": "Bouira", "price": 450 },
                    { "wilayaId": 11, "wilayaName": "Tamanrasset", "price": 1200 },
                    { "wilayaId": 12, "wilayaName": "Tébessa", "price": 800 },
                    { "wilayaId": 13, "wilayaName": "Tlemcen", "price": 600 },
                    { "wilayaId": 14, "wilayaName": "Tiaret", "price": 700 },
                    { "wilayaId": 15, "wilayaName": "Tizi Ouzou", "price": 500 },
                    { "wilayaId": 16, "wilayaName": "Alger", "price": 500 },
                    { "wilayaId": 17, "wilayaName": "Djelfa", "price": 750 },
                    { "wilayaId": 18, "wilayaName": "Jijel", "price": 600 },
                    { "wilayaId": 19, "wilayaName": "Sétif", "price": 550 },
                    { "wilayaId": 20, "wilayaName": "Saïda", "price": 800 },
                    { "wilayaId": 21, "wilayaName": "Skikda", "price": 580 },
                    { "wilayaId": 22, "wilayaName": "Sidi Bel Abbès", "price": 620 },
                    { "wilayaId": 23, "wilayaName": "Annaba", "price": 500 },
                    { "wilayaId": 24, "wilayaName": "Guelma", "price": 530 },
                    { "wilayaId": 25, "wilayaName": "Constantine", "price": 480 },
                    { "wilayaId": 26, "wilayaName": "Médéa", "price": 550 },
                    { "wilayaId": 27, "wilayaName": "Mostaganem", "price": 650 },
                    { "wilayaId": 28, "wilayaName": "M'Sila", "price": 700 },
                    { "wilayaId": 29, "wilayaName": "Mascara", "price": 720 },
                    { "wilayaId": 30, "wilayaName": "Ouargla", "price": 1000 },
                    { "wilayaId": 31, "wilayaName": "Oran", "price": 550 },
                    { "wilayaId": 32, "wilayaName": "El Bayadh", "price": 850 },
                    { "wilayaId": 33, "wilayaName": "Illizi", "price": 1500 },
                    { "wilayaId": 34, "wilayaName": "Bordj Bou Arréridj", "price": 520 },
                    { "wilayaId": 35, "wilayaName": "Boumerdès", "price": 450 },
                    { "wilayaId": 36, "wilayaName": "El Tarf", "price": 580 },
                    { "wilayaId": 37, "wilayaName": "Tindouf", "price": 1300 },
                    { "wilayaId": 38, "wilayaName": "Tissemsilt", "price": 700 },
                    { "wilayaId": 39, "wilayaName": "El Oued", "price": 950 },
                    { "wilayaId": 40, "wilayaName": "Khenchela", "price": 680 },
                    { "wilayaId": 41, "wilayaName": "Souk Ahras", "price": 600 },
                    { "wilayaId": 42, "wilayaName": "Tipaza", "price": 400 },
                    { "wilayaId": 43, "wilayaName": "Mila", "price": 570 },
                    { "wilayaId": 44, "wilayaName": "Aïn Defla", "price": 480 },
                    { "wilayaId": 45, "wilayaName": "Naâma", "price": 700 },
                    { "wilayaId": 46, "wilayaName": "Aïn Témouchent", "price": 630 },
                    { "wilayaId": 47, "wilayaName": "Ghardaïa", "price": 900 },
                    { "wilayaId": 48, "wilayaName": "Relizane", "price": 700 },
                    { "wilayaId": 49, "wilayaName": "Timimoun", "price": 1100 },
                    { "wilayaId": 50, "wilayaName": "Bordj Badji Mokhtar", "price": 1800 },
                    { "wilayaId": 51, "wilayaName": "Ouled Djellal", "price": 850 },
                    { "wilayaId": 52, "wilayaName": "Béni Abbès", "price": 1050 },
                    { "wilayaId": 53, "wilayaName": "Timimoun (Nouvelle)", "price": 1100 },
                    { "wilayaId": 54, "wilayaName": "Touggourt", "price": 980 },
                    { "wilayaId": 55, "wilayaName": "Djanet", "price": 1600 },
                    { "wilayaId": 56, "wilayaName": "El M'Ghair", "price": 890 },
                    { "wilayaId": 57, "wilayaName": "El Meniaa", "price": 1000 },
                    { "wilayaId": 58, "wilayaName": "In Salah", "price": 1400 }
                ],
                // These will be fetched from the database if available, otherwise null.
                facebookPixelId: pixelConfig ? pixelConfig.facebookPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null
            };

            res.status(200).json(siteConfigData);
        } catch (error) {
            console.error('Error fetching site configuration:', error.message);
            // Provide a generic error message to the client for security
            res.status(500).json({ message: 'Failed to fetch site configuration. Please try again.' });
        }
    }
};

module.exports = PixelController;
