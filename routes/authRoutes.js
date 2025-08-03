/**
 * FILE: ./routes/authRoutes.js
 * DESC: This file defines the API endpoints for authentication and maps them
 * to the corresponding controller functions.
 *
 * MODIFIED:
 * - Replaced `identifyTenant` with `tenantMiddleware` to match the project's
 * actual middleware implementation.
 * - Updated the `protect` middleware to use `req.tenant.tenantId` and `req.jwtSecret`
 * which are provided by the `tenantMiddleware`, ensuring consistency.
 */
const express = require('express');
const { body, param } = require('express-validator');
const jwt = require('jsonwebtoken');
const authController = require('../controllers/authController');
const User = require('../models/User'); // Assuming a global User model
const tenantMiddleware = require('../middleware/tenantMiddleware'); // <-- CRITICAL: Using your tenant middleware

// --- Real JWT Authentication Middleware ---
const protect = async (req, res, next) => {
    let token;

    // Check for token in the Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract token from "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // The tenantMiddleware MUST have run before this.
            // It provides req.tenant and req.jwtSecret.
            if (!req.tenant || !req.jwtSecret) {
                console.error('PROTECT ERROR: Tenant/JWT Secret not found on request. `tenantMiddleware` may have failed.');
                return res.status(500).json({ message: 'Server configuration error: JWT secret not found.' });
            }

            // Verify the token using the tenant-specific secret
            const decoded = jwt.verify(token, req.jwtSecret);

            // Find the user by their ID and the tenant's numeric ID.
            // This ensures the token is valid for the specific tenant.
            req.user = await User.findOne({
                _id: decoded.id,
                tenantId: req.tenant.tenantId // <-- Use the ID from the tenant object
            }).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found for this tenant.' });
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

// --- Public Routes (but require tenant identification) ---
router.post('/check-email', tenantMiddleware, [body('email', 'Please enter a valid email.').isEmail().normalizeEmail()], authController.checkEmail);

router.post('/register', tenantMiddleware, [
    body('name', 'Name is required.').trim().not().isEmpty(),
    body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
    body('password', 'Password must be at least 6 characters.').isLength({ min: 6 })
], authController.register);

router.post('/login', tenantMiddleware, [
    body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
    body('password', 'Password is required.').not().isEmpty()
], authController.login);

// --- Protected Routes (require tenant ID, then a valid token) ---
router.get('/users/:id/index', tenantMiddleware, protect, [param('id', 'Invalid user ID').isMongoId()], authController.getUserIndex);

router.put('/users/:id/index', tenantMiddleware, protect, [
    param('id', 'Invalid user ID').isMongoId(),
    body('newIndexValue', 'Index value must be a number.').isNumeric()
], authController.updateIndex);

// --- Admin-only Routes (require tenant ID, token, and admin role) ---
router.get('/users', tenantMiddleware, protect, admin, authController.getUsers);

module.exports = router;
