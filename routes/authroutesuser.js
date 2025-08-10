// FILE: ./routes/userRoutes.js
// INSTRUCTIONS: Replace the content of your userRoutes.js file with this code.
// ==================================================================================
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const AuthController = require('../controllers/authcontrolleruser');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');

// @route   POST /api/users/login
// @desc    Authenticate a user and get a token.
// @access  Public
router.post(
    '/login', 
    [
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Password is required').exists()
    ],
    AuthController.login
);

// @route   POST /api/users/register
// @desc    Register a new user.
// @access  Private (Requires Admin role)
router.post(
    '/register',
    [protect, isAdmin], // Protects the route and ensures only admins can access it.
    AuthController.registerUser
);

// @route   GET /api/users
// @desc    Get all users for the current tenant.
// @access  Private (Requires Admin role)
router.get(
    '/',
    [protect, isAdmin],
    AuthController.getUsers
);

// @route   PUT /api/users/:id/index
// @desc    Update a user's active/inactive status.
// @access  Private (Requires Admin role)
router.put(
    '/:id/index',
    [protect, isAdmin],
    AuthController.updateUserStatus
);

module.exports = router;

