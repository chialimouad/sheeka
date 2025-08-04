/**
 * FILE: ./routes/userRoutes.js
 * DESC: Defines API endpoints for staff user management.
 *
 * FIX:
 * - Corrected middleware imports to use the single, consolidated `authMiddleware.js`.
 * - Corrected the controller import path to `authController`.
 * - **CRITICAL SECURITY FIX**: Added `protect` and `isAdmin` middleware to the
 * `/register` route. This ensures that only authenticated administrators can
 * create new users, which is the intended behavior for this management page.
 */
const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

// Controller functions
const {
    register,
    login,
    getUsers,
    updateIndex,
    getUserIndex
} = require('../controllers/authController'); // Corrected controller file name

// Middleware from the single source of truth
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// =========================
// Public Routes (Tenant-Aware)
// =========================

/**
 * @route   POST /users/login
 * @desc    Authenticate staff user
 * @access  Public (requires tenant header)
 */
router.post(
    '/login',
    identifyTenant,
    [
        body('email').isEmail().withMessage('Please include a valid email'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    login
);

// =========================
// Admin Protected Routes
// =========================

/**
 * @route   POST /users/register
 * @desc    Register a new staff user (tenant-scoped)
 * @access  Private (Admin Only)
 */
router.post(
    '/register',
    identifyTenant,
    protect, // <-- FIX: This route must be protected
    isAdmin, // <-- FIX: Only admins can register new users
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Please include a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be 6 or more characters'),
        body('role').isIn(['admin', 'confirmation', 'stockagent', 'user', 'employee']).withMessage('Invalid role'),
        body('index').optional().isInt({ min: 0, max: 1 }).withMessage('Index must be 0 or 1'),
    ],
    register
);

/**
 * @route   GET /users
 * @desc    Get all staff users for a tenant
 * @access  Private (Admin only)
 */
router.get(
    '/',
    identifyTenant,
    protect,
    isAdmin,
    getUsers
);

/**
 * @route   GET /users/:id/index
 * @desc    Get user's index by ID
 * @access  Private (Admin only)
 */
router.get(
    '/:id/index',
    identifyTenant,
    protect,
    isAdmin,
    [
        param('id').isMongoId().withMessage('Invalid user ID format')
    ],
    getUserIndex
);

/**
 * @route   PUT /users/:id/index
 * @desc    Update a user's index (admin or self)
 * @access  Private (controller enforces access control)
 */
router.put(
    '/:id/index',
    identifyTenant,
    protect,
    [
        param('id').isMongoId().withMessage('Invalid user ID format'),
        body('newIndexValue')
            .isInt({ min: 0, max: 1 })
            .withMessage('A new index value of 0 or 1 is required')
    ],
    updateIndex
);

module.exports = router;
