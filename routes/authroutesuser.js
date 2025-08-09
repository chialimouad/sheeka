/**
 * FILE: ./routes/authRoutes.js
 * DESC: Defines API endpoints for staff user management.
 *
 * FIX:
 * - Corrected the controller import path from 'authcontrolleruser' to 'authController'.
 * - This change ensures that the routes correctly connect to their handler functions,
 * resolving the 404 error when fetching or managing users.
 */
const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

// Controller functions
// FIX: Corrected the controller filename to match the actual file.
const AuthController = require('../controllers/authcontrolleruser');

// Middleware from the single source of truth
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// =========================
// Public Routes (Tenant-Aware)
// =========================

/**
 * @route     POST /users/login
 * @desc      Authenticate staff user
 * @access    Public (requires tenant header)
 */
router.post(
    '/login',
    identifyTenant,
    [
        body('email').isEmail().withMessage('Please include a valid email'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    AuthController.login
);

// =========================
// Admin Protected Routes
// =========================

/**
 * @route     POST /users/register
 * @desc      Register a new staff user (tenant-scoped)
 * @access    Private (Admin Only)
 */
router.post(
    '/register',
    identifyTenant,
    protect,
    isAdmin,
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Please include a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be 6 or more characters'),
        body('role').isIn(['admin', 'confirmation', 'stockagent', 'user', 'employee']).withMessage('Invalid role'),
    ],
    AuthController.registerUser
);

/**
 * @route     GET /users
 * @desc      Get all staff users for a tenant
 * @access    Private (Admin only)
 */
router.get(
    '/',
    identifyTenant,
    protect,
    isAdmin,
    AuthController.getUsers
);

/**
 * @route     PUT /users/:id/index
 * @desc      Update a user's index (status)
 * @access    Private (Admin Only)
 */
router.put(
    '/:id/index',
    identifyTenant,
    protect,
    isAdmin, // Only admins should change user status
    [
        param('id').isMongoId().withMessage('Invalid user ID format'),
        body('index')
            .isInt({ min: 0, max: 1 })
            .withMessage('A new index value of 0 or 1 is required')
    ],
    AuthController.updateUserStatus
);

module.exports = router;
authcontrolleruser
