// routes/provisioningRoutes.js

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Import the controller that handles the logic for creating a new client
const { provisionNewClient } = require('../controllers/provisioningController');

// Note: The 'isSuperAdmin' middleware is applied in server.js before this router is used.

/**
 * @route   POST /api/provision/client
 * @desc    Creates a new client instance (tenant) with its own configuration and admin user.
 * @access  Private (Super Admin Only)
 */
router.post(
    '/client',
    [
        // --- Input Validation ---
        // This ensures that all the data from your "Super Admin" HTML page is present and valid.
        body('clientName', 'Client business name is required').not().isEmpty().trim(),
        body('subdomain', 'A valid subdomain is required').isSlug().toLowerCase(),
        body('adminEmail', 'A valid admin email is required').isEmail(),
        body('adminPassword', 'Admin password must be at least 8 characters long').isLength({ min: 8 }),
        body('cloudinaryCloudName', 'Cloudinary Cloud Name is required').not().isEmpty(),
        body('cloudinaryApiKey', 'Cloudinary API Key is required').not().isEmpty(),
        body('cloudinaryApiSecret', 'Cloudinary API Secret is required').not().isEmpty(),
        body('nodemailerEmail', 'Nodemailer sending email is required').isEmail(),
        body('nodemailerAppPassword', 'Nodemailer App Password is required').not().isEmpty(),
    ],
    provisionNewClient
);

module.exports = router;
