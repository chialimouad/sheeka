/**
 * @fileoverview Handles API logic for pixel ID management.
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
    }
};

module.exports = PixelController;
