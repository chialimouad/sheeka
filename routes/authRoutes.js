const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Import controller functions from authController
const {
    register,
    login,
    getUsers,
    updateindex,
    getUserIndex
} = require('../controllers/authController');

// You would typically have an auth middleware to protect these routes
// For example: const { protect, admin } = require('../middleware/authMiddleware');


// --- Authentication Routes ---

/**
 * @route   POST api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', [
    // Validation middleware for the registration request
    body('name', 'Name is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    body('index', 'Index must be a number (0 or 1)').optional().isNumeric().isIn([0, 1]),
], register);

/**
 * @route   POST api/auth/login
 * @desc    Authenticate user & get token (login)
 * @access  Public
 */
router.post('/login', [
    // Validation middleware for the login request
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists(),
], login);


// --- User Data Routes ---

/**
 * @route   GET api/auth/users
 * @desc    Get all users
 * @access  Private/Admin (should be protected by auth middleware)
 */
router.get('/users', /* protect, admin, */ getUsers);

/**
 * @route   GET api/auth/:id/index
 * @desc    Get a user's index by their ID
 * @access  Private (should be protected by auth middleware)
 */
router.get('/:id/index', /* protect, */ getUserIndex);

/**
 * @route   PUT api/auth/:id/index
 * @desc    Update a user's index
 * @access  Private (should be protected by auth middleware)
 */
router.put('/:id/index', [
    // protect, // Example of protecting the route
    // Validation for the new index value
    body('newIndexValue', 'A new index value of 0 or 1 is required').isNumeric().isIn([0, 1])
], updateindex);


module.exports = router;
