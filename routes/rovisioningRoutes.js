// routes/provisioningRoutes.js

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { provisionNewClient } = require('../controllers/provisioningController');

/**
 * @route   POST /api/provision/client
 * @desc    Creates a new client instance (tenant)
 * @access  Private (Super Admin Only)
 */
router.post(
    '/client',
    [
        body('clientName', 'Client business name is required').not().isEmpty().trim(),
        body('adminEmail', 'A valid admin email is required').isEmail(),
        body('adminPassword', 'Admin password must be at least 8 characters long').isLength({ min: 8 }),
        body('cloudinaryCloudName', 'Cloudinary Cloud Name is required').not().isEmpty(),
        body('cloudinaryApiKey', 'Cloudinary API Key is required').not().isEmpty(),
        body('cloudinaryApiSecret', 'Cloudinary API Secret is required').not().isEmpty()
        // 🧹 Nodemailer fields removed
    ],
    provisionNewClient
);

module.exports = router;
