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
        body('clientName')
            .notEmpty()
            .withMessage('Client business name is required')
            .trim(),

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
    provisionNewClient
);

module.exports = router;
