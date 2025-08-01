// routes/userRoutes.js

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
} = require('../controllers/authcontrolleruser');

// Middleware
const { identifyTenant } = require('../middleware/tenantMiddleware');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// =========================
// Public Staff Routes (Scoped to Tenant)
// =========================

/**
 * @route   POST /api/users/register
 * @desc    Register a new staff user for the current tenant
 * @access  Public (Tenant header required)
 */
router.post(
    '/register',
    identifyTenant,
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').isIn(['admin', 'confirmation', 'stockagent', 'user']).withMessage('Invalid role'),
        body('index').optional().isInt({ min: 0, max: 1 }).withMessage('Index must be 0 or 1'),
    ],
    register
);

/**
 * @route   POST /api/users/login
 * @desc    Authenticate a staff user
 * @access  Public (Tenant header required)
 */
router.post(
    '/login',
    identifyTenant,
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    login
);

// =========================
// Protected Admin Routes
// =========================

/**
 * @route   GET /api/users
 * @desc    Get all users for the current tenant
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
 * @route   GET /api/users/:id/index
 * @desc    Get a specific user's index
 * @access  Private (Admin only)
 */
router.get(
    '/:id/index',
    identifyTenant,
    protect,
    isAdmin,
    [
        param('id').isMongoId().withMessage('Invalid user ID format'),
    ],
    getUserIndex
);

/**
 * @route   PUT /api/users/:id/index
 * @desc    Update a user’s index (Admin can update any, users can update their own — handled in controller)
 * @access  Private
 */
router.put(
    '/:id/index',
    identifyTenant,
    protect,
    [
        param('id').isMongoId().withMessage('Invalid user ID format'),
        body('newIndexValue')
            .isInt({ min: 0, max: 1 })
            .withMessage('New index value must be 0 or 1'),
    ],
    updateIndex
);

module.exports = router;
