// routes/provisioningRoutes.js

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { createClient } = require('../controllers/provisioningController'); // Adjusted to match controller export
const { isSuperAdmin } = require('../middleware/superAdminMiddleware');

/**
 * @route   POST /api/provision/client
 * @desc    Creates a new client instance (tenant)
 * @access  Private (Super Admin Only)
 */
router.post(
    '/client',
    isSuperAdmin,
    [
        body('clientName')
            .trim()
            .notEmpty()
            .withMessage('Client business name is required'),

        // **FIX**: Added validation for the subdomain field.
        body('subdomain')
            .trim()
            .notEmpty()
            .withMessage('Subdomain is required')
            .isSlug() // Ensures it's a URL-friendly string (e.g., "my-store")
            .withMessage('Subdomain can only contain letters, numbers, and hyphens.'),

        body('adminEmail')
            .isEmail()
            .withMessage('A valid admin email is required')
            .normalizeEmail(),

        body('adminPassword')
            .isLength({ min: 8 })
            .withMessage('Admin password must be at least 8 characters long'),

        body('cloudinaryCloudName')
            .notEmpty()
            .withMessage('Cloudinary Cloud Name is required'),

        body('cloudinaryApiKey')
            .notEmpty()
            .withMessage('Cloudinary API Key is required'),

        body('cloudinaryApiSecret')
            .notEmpty()
            .withMessage('Cloudinary API Secret is required')
    ],
    createClient // Using the corrected controller function name
);

module.exports = router;
