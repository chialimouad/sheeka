/**
 * FILE: ./routes/authRoutes.js
 * DESC: Defines API endpoints for authentication.
 *
 * FIX:
 * - Removed the inline middleware definitions for `identifyTenant`, `protect`, and `admin`.
 * - Now imports the corrected and centralized middleware from `./middleware/authMiddleware.js`.
 * - The route definitions remain the same, but they are now cleaner and use the reliable,
 * imported middleware, ensuring the correct execution order.
 */
const express = require('express');
const { body, param } = require('express-validator');
const authController = require('../controllers/authController');

// Import the centralized authentication middleware
const {
    identifyTenant,
    protect,
    admin
} = require('../middleware/authMiddleware');

const router = express.Router();

// --- Public Routes ---
// All public routes still need to identify the tenant before proceeding.
router.post(
    '/check-email',
    identifyTenant, // First, identify which tenant this request is for.
    [body('email', 'Please enter a valid email.').isEmail().normalizeEmail()],
    authController.checkEmail
);

router.post(
    '/register',
    identifyTenant, // First, identify the tenant.
    [
        body('name', 'Name is required.').trim().not().isEmpty(),
        body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
        body('password', 'Password must be at least 6 characters.').isLength({ min: 6 })
    ],
    authController.register
);

router.post(
    '/login',
    identifyTenant, // First, identify the tenant.
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
    identifyTenant, // 1. Identify Tenant
    protect,        // 2. Verify Token
    [param('id', 'Invalid user ID').isMongoId()],
    authController.getUserIndex
);

router.put(
    '/users/:id/index',
    identifyTenant, // 1. Identify Tenant
    protect,        // 2. Verify Token
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
    identifyTenant, // 1. Identify Tenant
    protect,        // 2. Verify Token
    admin,          // 3. Check for Admin Role
    authController.getUsers
);

module.exports = router;
