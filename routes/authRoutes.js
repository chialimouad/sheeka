/**
 * FILE: ./routes/authRoutes.js
 * DESC: Defines API endpoints for authentication.
 *
 * FIX:
 * - Updated the `verifyTenantData` middleware to correctly check for the jwtSecret
 * inside the nested `config` object (`req.tenant.config.jwtSecret`).
 * - This change aligns the code with the structure of your tenant document in the
 * database, resolving the "jwtSecret is missing" error.
 * - The error message has also been updated for clarity.
 */
const express = require('express');
const { body, param } = require('express-validator');
const authController = require('../controllers/authController');

// Import the centralized authentication middleware
const {
    identifyTenant,
    protect,
    isAdmin
} = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @desc A local middleware to ensure the tenant object from `identifyTenant`
 * is complete before it reaches a controller that needs to generate a JWT.
 */
const verifyTenantData = (req, res, next) => {
    // This check now correctly looks for the jwtSecret inside the nested 'config' object.
    if (!req.tenant || !req.tenant.config || !req.tenant.config.jwtSecret) {
        const tenantIdentifier = req.tenant?.customDomain || req.tenant?.tenantId || 'Unknown Tenant';
        
        // Log a more detailed error on the server for easier debugging.
        console.error(`ROUTER-LEVEL CHECK FAILED: jwtSecret is missing from the 'config' object for tenant: ${tenantIdentifier}.`);
        
        // Send a clear, specific error back to the client.
        return res.status(500).json({
            message: `Server configuration error: The configuration for your account (${tenantIdentifier}) is incomplete. Please contact support.`
        });
    }
    // If the data is valid, proceed to the next middleware or controller.
    next();
};


// --- Public Routes ---
// All public routes still need to identify the tenant before proceeding.
router.post(
    '/check-email',
    identifyTenant,
    [body('email', 'Please enter a valid email.').isEmail().normalizeEmail()],
    authController.checkEmail
);

router.post(
    '/register',
    identifyTenant,   // 1. Identify the tenant.
    verifyTenantData, // 2. Verify tenant has a JWT secret, in case of auto-login.
    [
        body('name', 'Name is required.').trim().not().isEmpty(),
        body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
        body('password', 'Password must be at least 6 characters.').isLength({ min: 6 })
    ],
    authController.register
);

router.post(
    '/login',
    identifyTenant,   // 1. Finds the tenant based on hostname or header.
    verifyTenantData, // 2. Verifies the returned tenant object is valid for creating a token.
    [
        body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
        body('password', 'Password is required.').not().isEmpty()
    ],
    authController.login
);

// --- Protected Routes ---
// These require tenant identification first, then a valid user token.
// The `protect` middleware already contains its own check for the jwtSecret.
router.get(
    '/users/:id/index',
    identifyTenant,
    protect,
    [param('id', 'Invalid user ID').isMongoId()],
    authController.getUserIndex
);

router.put(
    '/users/:id/index',
    identifyTenant,
    protect,
    [
        param('id', 'Invalid user ID').isMongoId(),
        body('newIndexValue', 'Index value must be a number.').isNumeric()
    ],
    authController.updateIndex
);

// --- Admin-only Routes ---
// These require tenant ID, a valid token, and an admin role.
router.get(
    '/users',
    identifyTenant,
    protect,
    isAdmin,
    authController.getUsers
);

module.exports = router;
