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
// Public Routes (Tenant-Aware)
// =========================

/**
 * @route   POST /api/users/register
 * @desc    Register a new staff user (tenant-scoped)
 * @access  Public (requires tenant header)
 */
router.post(
    '/register',
    identifyTenant,
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Please include a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be 6 or more characters'),
        body('role').isIn(['admin', 'confirmation', 'stockagent', 'user']).withMessage('Invalid role'),
        body('index').optional().isInt({ min: 0, max: 1 }).withMessage('Index must be 0 or 1'),
    ],
    register
);

/**
 * @route   POST /api/users/login
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
 * @route   GET /api/users
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
 * @route   GET /api/users/:id/index
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
 * @route   PUT /api/users/:id/index
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
