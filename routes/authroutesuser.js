// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

// Import the refactored controller functions
const {
    register,
    login,
    getUsers,
    updateIndex,
    getUserIndex
} = require('../controllers/authcontrolleruser'); // Corrected controller name

// Import the necessary middleware for security and tenant identification
// These files would need to be created in your middleware directory.
const { identifyTenant } = require('../middleware/tenantMiddleware');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// =========================
// Public User Routes (Tenant-Aware)
// These routes are for staff/admin users to register and log into their specific client dashboard.
// =========================

/**
 * @route   POST /api/users/register
 * @desc    Register a new staff user for the current client
 * @access  Public (but scoped to a tenant)
 */
router.post('/register', [
    identifyTenant, // Identifies which client this request is for
    body('name', 'Name is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
    body('role', 'A valid role is required').isIn(['admin', 'confirmation', 'stockagent', 'user']),
    body('index').optional().isNumeric().isIn([0, 1]),
], register);

/**
 * @route   POST /api/users/login
 * @desc    Authenticate a staff user & get token
 * @access  Public (but scoped to a tenant)
 */
router.post('/login', [
    identifyTenant, // Identifies which client this request is for
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists(),
], login);


// =========================
// Protected Admin Routes
// These routes require a user to be logged in and have an 'admin' role.
// =========================

/**
 * @route   GET /api/users
 * @desc    Get all users for the current client
 * @access  Private (Admin)
 */
router.get('/', identifyTenant, protect, isAdmin, getUsers);

/**
 * @route   GET /api/users/:id/index
 * @desc    Get a specific user's index by their ID
 * @access  Private (Admin)
 */
router.get('/:id/index', [
    identifyTenant,
    protect,
    isAdmin,
    param('id').isMongoId().withMessage('Invalid user ID format')
], getUserIndex);

/**
 * @route   PUT /api/users/:id/index
 * @desc    Update a user's index
 * @access  Private (Admin can update anyone, User can update themselves)
 */
router.put('/:id/index', [
    identifyTenant,
    protect, // Protects the route, controller handles role logic
    param('id').isMongoId().withMessage('Invalid user ID format'),
    body('newIndexValue', 'A new index value of 0 or 1 is required').isNumeric().isIn([0, 1])
], updateIndex);


module.exports = router;
