/**
 * FILE: ./controllers/pixelController.js
 * DESC: Controller functions for managing Facebook and TikTok Pixel IDs for a tenant.
 */
const PixelModel = require('../models/pixel');
const { validationResult } = require('express-validator');

const PixelController = {
    /**
     * @desc    Create a new pixel configuration for the current tenant.
     * @route   POST /site-config/pixels
     * @access  Private (Admin)
     */
    postPixel: async (req, res) => {
        try {
            const { fbPixelId, tiktokPixelId } = req.body;
            // The tenant's MongoDB ObjectId is attached by the identifyTenant middleware
            const tenantObjectId = req.tenant._id;

            if (!fbPixelId && !tiktokPixelId) {
                return res.status(400).json({ message: 'At least one Pixel ID must be provided.' });
            }

            const newPixel = await PixelModel.create({
                fbPixelId,
                tiktokPixelId,
                tenantId: tenantObjectId // Link to the client document
            });

            res.status(201).json({
                message: 'Pixel IDs stored successfully!',
                pixel: newPixel
            });
        } catch (error) {
            console.error('Error saving pixel IDs:', error);
            res.status(500).json({ message: 'Failed to save pixel IDs.' });
        }
    },

    /**
     * @desc    Get all pixel configurations for the current tenant.
     * @route   GET /site-config/pixels
     * @access  Private (Admin)
     */
    getPixels: async (req, res) => {
        try {
            const tenantObjectId = req.tenant._id;
            const pixels = await PixelModel.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 });
            res.status(200).json({
                message: 'Fetched all pixel IDs successfully!',
                pixels
            });
        } catch (error) {
            console.error('Error fetching pixel IDs:', error);
            res.status(500).json({ message: 'Failed to fetch pixel IDs.' });
        }
    },

    /**
     * @desc    Delete a pixel configuration by its ID.
     * @route   DELETE /site-config/pixels/:id
     * @access  Private (Admin)
     */
    deletePixel: async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const pixelId = req.params.id;
            const tenantObjectId = req.tenant._id;

            const deletedPixel = await PixelModel.findOneAndDelete({ _id: pixelId, tenantId: tenantObjectId });

            if (!deletedPixel) {
                return res.status(404).json({ message: 'Pixel ID not found for this tenant.' });
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
};

module.exports = { PixelController };
