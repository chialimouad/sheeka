/**
 * FILE: ./routes/authRoutes.js
 * DESC: Defines API endpoints for authentication.
 *
 * FIX:
 * - The `verifyTenantData` middleware is now also applied to the `/register` route.
 * - This is a proactive fix. If the registration process is designed to
 * automatically log the user in and issue a JWT token, it will also require
 * the `jwtSecret`. Adding this check prevents potential errors during registration
 * if the tenant's data is incomplete.
 * - This makes the routes more robust by ensuring any route that might create a
 * token has the necessary data before proceeding.
 * - **UPDATE**: Enhanced the `verifyTenantData` middleware to include the tenant's
 * identifier in the error message. This makes it easier to diagnose which
 * specific tenant record is missing its `jwtSecret` in the database.
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
    // This check verifies that the `identifyTenant` middleware found a tenant
    // AND that the tenant's data includes a jwtSecret.
    if (!req.tenant || !req.tenant.jwtSecret) {
        const tenantIdentifier = req.tenant?.customDomain || req.tenant?.tenantId || 'Unknown Tenant';
        
        // Log a more detailed error on the server for easier debugging.
        console.error(`ROUTER-LEVEL CHECK FAILED: jwtSecret is missing for tenant: ${tenantIdentifier}.`);
        
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
