/**
 * FILE: ./routes/authRoutes.js
 * DESC: Defines API endpoints for authentication.
 *
 * FIX:
 * - Added a new local middleware `verifyTenantData` to the login route.
 * - This new middleware runs immediately after `identifyTenant` and ensures that the
 * tenant object and, crucially, the `tenant.jwtSecret` have been successfully
 * attached to the request.
 * - This prevents the request from reaching the controller with incomplete data,
 * providing a more robust and clearer error if the tenant's record in the
 * database is missing the required JWT secret.
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
 * is complete before it reaches the controller.
 */
const verifyTenantData = (req, res, next) => {
    // This check is crucial. It verifies that the `identifyTenant` middleware
    // not only found a tenant but that the tenant's data includes a jwtSecret.
    if (!req.tenant || !req.tenant.jwtSecret) {
        console.error('ROUTER-LEVEL CHECK FAILED: Tenant data is incomplete or missing jwtSecret.');
        return res.status(500).json({
            message: 'Server configuration error: Tenant data is incomplete. Please contact support.'
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
    identifyTenant,
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
    verifyTenantData, // 2. NEW: Verifies the returned tenant object is valid.
    [
        body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
        body('password', 'Password is required.').not().isEmpty()
    ],
    authController.login
);

// --- Protected Routes ---
// These require tenant identification first, then a valid user token.
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
