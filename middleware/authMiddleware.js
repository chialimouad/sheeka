// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Customer = require('../models/Customer');

/**
 * @desc    Protects routes by verifying a staff user's (e.g., admin) JWT.
 * Attaches the authenticated user to the request object.
 */
const protect = async (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            token = authHeader.split(' ')[1];

            // The tenant MUST be identified before this middleware runs.
            if (!req.client || !req.client.config || !req.client.config.jwtSecret) {
                return res.status(401).json({ message: 'Not authorized, client JWT secret is missing.' });
            }

            // Verify the token using the tenant-specific secret key.
            const decoded = jwt.verify(token, req.client.config.jwtSecret);

            // Find the user by ID and ensure they belong to the correct tenant.
            req.user = await User.findOne({ _id: decoded.id, tenantId: req.tenantId }).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found for this client.' });
            }

            next();
        } catch (error) {
            console.error('Authentication Error:', error);
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

/**
 * @desc    Authorization middleware to check if the logged-in user is an admin.
 * @note    This must be used AFTER the `protect` middleware.
 */
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden. Admin access required.' });
    }
};

/**
 * @desc    Protects routes by verifying an end-customer's JWT.
 * Attaches the authenticated customer to the request object.
 */
const protectCustomer = async (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            token = authHeader.split(' ')[1];

            if (!req.client || !req.client.config || !req.client.config.jwtSecret) {
                return res.status(401).json({ message: 'Not authorized, client JWT secret is missing.' });
            }

            const decoded = jwt.verify(token, req.client.config.jwtSecret);

            // Find the customer by ID and ensure they belong to the correct tenant.
            req.customer = await Customer.findOne({ _id: decoded.id, tenantId: req.tenantId }).select('-password');

            if (!req.customer) {
                return res.status(401).json({ message: 'Not authorized, customer not found for this client.' });
            }

            next();
        } catch (error) {
            console.error('Customer Authentication Error:', error);
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};


module.exports = { protect, isAdmin, protectCustomer };
