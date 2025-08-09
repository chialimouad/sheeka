// ==================================================================================
// FILE: ./routes/userRoutes.js
// INSTRUCTIONS: Create this new file or replace its contents with the code below.
// This file defines all the API routes related to user authentication and management.
// ==================================================================================
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const AuthController = require('../controllers/authcontrolleruser');
const { protect } = require('../middleware/authMiddleware'); // Middleware to protect routes
const { isAdmin } = require('../middleware/adminMiddleware'); // Middleware to check for admin role

// @route   POST /api/users/login
// @desc    Authenticate user & get token
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
// @desc    Register a new user
// @access  Private (Admin)
router.post(
    '/register',
    [protect, isAdmin], // Only logged-in admins can register new users
    AuthController.registerUser
);

// @route   GET /api/users
// @desc    Get all users for the tenant
// @access  Private (Admin)
router.get(
    '/',
    [protect, isAdmin],
    AuthController.getUsers
);

// @route   PUT /api/users/:id/index
// @desc    Update user status (active/inactive)
// @access  Private (Admin)
router.put(
    '/:id/index',
    [protect, isAdmin],
    AuthController.updateUserStatus
);

module.exports = router;

