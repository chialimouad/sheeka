const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const ProvisioningController = require('../controllers/provisioningController'); 
const { isSuperAdmin } = require('../middleware/superAdminMiddleware');

router.post(
    '/client',
    isSuperAdmin,
    [
        body('clientName').trim().notEmpty().withMessage('Client business name is required'),
        body('subdomain').trim().notEmpty().withMessage('Subdomain is required').isSlug().withMessage('Subdomain can only contain letters, numbers, and hyphens.'),
        body('adminEmail').isEmail().withMessage('A valid admin email is required').normalizeEmail(),
        body('adminPassword').isLength({ min: 8 }).withMessage('Admin password must be at least 8 characters long'),
        body('adminPhoneNumber').trim().notEmpty().withMessage('Administrator phone number is required'),
        body('cloudinaryCloudName').notEmpty().withMessage('Cloudinary Cloud Name is required'),
        body('cloudinaryApiKey').notEmpty().withMessage('Cloudinary API Key is required'),
        body('cloudinaryApiSecret').notEmpty().withMessage('Cloudinary API Secret is required')
    ],
    ProvisioningController.createClient
);

module.exports = router;
