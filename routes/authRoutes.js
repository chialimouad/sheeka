/**
 * FILE: ./routes/authRoutes.js
 * DESC: This file defines the API endpoints for authentication and maps them
 * to the corresponding controller functions.
 *
 * MODIFIED:
 * - Moved the `identifyTenant` middleware function directly into this file to
 * resolve the 'MODULE_NOT_FOUND' error.
 * - Removed the external require statement for the middleware.
 * - Ensured all middleware (`identifyTenant`, `protect`, `admin`) are self-contained.
 */
const express = require('express');
const { body, param } = require('express-validator');
const jwt = require('jsonwebtoken');
const authController = require('../controllers/authController');
const User = require('../models/User'); // Assuming a global User model
const Client = require('../models/Client'); // Assuming a global Client model

// --- Tenant Identification Middleware ---
const identifyTenant = async (req, res, next) => {
    try {
        // The tenant ID is expected in the 'x-tenant-id' header.
        const tenantId = req.headers['x-tenant-id'];

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID header (x-tenant-id) is missing.' });
        }

        // Find the client by the unique numeric tenantId.
        const client = await Client.findOne({ tenantId: tenantId }).lean();

        if (!client) {
            return res.status(404).json({ message: 'Client not found for the provided tenant ID.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // Attach client information to the request for use in subsequent middleware and controllers.
        // This is where req.client and req.tenantId are set.
        req.client = client;
        req.tenantId = client.tenantId; // Pass the numeric tenantId
        req.jwtSecret = client.jwtSecret; // Pass the secret for token operations

        next();
    } catch (error) {
        console.error('Tenant Identification Error:', error);
        res.status(500).json({ message: 'Server error during client identification.' });
    }
};


// --- Real JWT Authentication Middleware ---
const protect = async (req, res, next) => {
    let token;

    // Check for token in the Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract token from "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // The identifyTenant middleware MUST have run before this.
            // It provides req.client (which contains the jwtSecret) and req.tenantId.
            if (!req.client || !req.client.jwtSecret) {
                console.error('PROTECT ERROR: Client/JWT Secret not found on request. `identifyTenant` may have failed.');
                return res.status(500).json({ message: 'Server configuration error: JWT secret not found.' });
            }

            // Verify the token using the client-specific secret
            const decoded = jwt.verify(token, req.client.jwtSecret);

            // Find the user by their ID and the numeric tenantId from the request.
            // This ensures the token is valid for the specific tenant.
            req.user = await User.findOne({
                _id: decoded.id,
                tenantId: req.tenantId // <-- Use the ID from the identifyTenant middleware
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
router.post('/check-email', identifyTenant, [body('email', 'Please enter a valid email.').isEmail().normalizeEmail()], authController.checkEmail);

router.post('/register', identifyTenant, [
    body('name', 'Name is required.').trim().not().isEmpty(),
    body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
    body('password', 'Password must be at least 6 characters.').isLength({ min: 6 })
], authController.register);

router.post('/login', identifyTenant, [
    body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
    body('password', 'Password is required.').not().isEmpty()
], authController.login);

// --- Protected Routes (require tenant ID, then a valid token) ---
router.get('/users/:id/index', identifyTenant, protect, [param('id', 'Invalid user ID').isMongoId()], authController.getUserIndex);

router.put('/users/:id/index', identifyTenant, protect, [
    param('id', 'Invalid user ID').isMongoId(),
    body('newIndexValue', 'Index value must be a number.').isNumeric()
], authController.updateIndex);

// --- Admin-only Routes (require tenant ID, token, and admin role) ---
router.get('/users', identifyTenant, protect, admin, authController.getUsers);

module.exports = router;
