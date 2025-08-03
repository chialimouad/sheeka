/**
 * FILE: ./routes/authRoutes.js
 * DESC: This file defines the API endpoints for authentication and maps them
 * to the corresponding controller functions.
 *
 * MODIFIED: Replaced placeholder 'protect' and 'admin' middleware with
 * functional implementations that use JWT for proper authentication and authorization.
 */
const express = require('express');
const { body, param } = require('express-validator');
const jwt = require('jsonwebtoken');
const authController = require('../controllers/authController');

// --- Real JWT Authentication Middleware ---
const protect = async (req, res, next) => {
    let token;

    // Check for token in the Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract token from "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // The tenantResolver middleware MUST have run before this to provide req.jwtSecret
            if (!req.jwtSecret) {
                return res.status(500).json({ message: 'Server configuration error: JWT secret not found.' });
            }

            // Verify the token
            const decoded = jwt.verify(token, req.jwtSecret);

            // Find the user from the token's ID within the tenant's context
            // and attach it to the request, excluding the password.
            req.user = await req.tenant.model('User').findById(decoded.id).select('-password');

            if (!req.user) {
                 return res.status(401).json({ message: 'Not authorized, user not found.' });
            }

            next(); // Proceed if token is valid
        } catch (error) {
            console.error('Token verification error:', error);
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token.' });
    }
};

// --- Real Admin Role-Checking Middleware ---
const admin = (req, res, next) => {
    // This middleware must run AFTER the 'protect' middleware
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin.' });
    }
};

// Create a new router instance
const router = express.Router();

// Public routes (no 'protect' middleware)
router.post('/check-email', [body('email', 'Please enter a valid email.').isEmail().normalizeEmail()], authController.checkEmail);
router.post('/register', [
    body('name', 'Name is required.').trim().not().isEmpty(),
    body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
    body('password', 'Password must be at least 6 characters.').isLength({ min: 6 })
], authController.register);
router.post('/login', [
    body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
    body('password', 'Password is required.').not().isEmpty()
], authController.login);

// Protected routes (require a valid token)
router.get('/users/:id/index', [param('id', 'Invalid user ID').isMongoId()], protect, authController.getUserIndex);
router.put('/users/:id/index', [
    param('id', 'Invalid user ID').isMongoId(),
    body('newIndexValue', 'Index value must be a number.').isNumeric()
], protect, authController.updateIndex);

// Admin-only routes (require admin role)
router.get('/users', protect, admin, authController.getUsers);


module.exports = router;
