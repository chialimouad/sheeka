// routes/provisioningRoutes.js

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Import the controller that handles the logic for creating a new client
const { provisionNewClient } = require('../controllers/provisioningController');

// --- Route: POST /api/provision/client ---
// Desc:    Creates a new client instance (tenant) with its own DB, config, and admin.
// Access:  Private (Super Admin Only) - validated by isSuperAdmin middleware in server.js

router.post(
    '/client',
    [
        // Validate input fields
        body('clientName')
            .notEmpty().withMessage('Client business name is required')
            .trim(),
        body('adminEmail')
            .isEmail().withMessage('A valid admin email is required'),
        body('adminPassword')
            .isLength({ min: 8 }).withMessage('Admin password must be at least 8 characters long'),
        body('cloudinaryCloudName')
            .notEmpty().withMessage('Cloudinary Cloud Name is required'),
        body('cloudinaryApiKey')
            .notEmpty().withMessage('Cloudinary API Key is required'),
        body('cloudinaryApiSecret')
            .notEmpty().withMessage('Cloudinary API Secret is required'),
        body('nodemailerEmail')
            .isEmail().withMessage('Nodemailer sending email is required'),
        body('nodemailerAppPassword')
            .notEmpty().withMessage('Nodemailer App Password is required'),
    ],
    provisionNewClient
);

module.exports = router;
