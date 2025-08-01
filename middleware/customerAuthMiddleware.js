// middleware/customerAuthMiddleware.js

const jwt = require('jsonwebtoken');
const Customer = require('../models/Client');

/**
 * @desc    Protects routes by verifying an end-customer's JWT.
 * Attaches the authenticated customer to the request object.
 * @note    This is separate from the 'protect' middleware which is for staff Users.
 */
const protectCustomer = async (req, res, next) => {
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

            // Ensure the token is for a customer, not a staff user.
            if (decoded.role !== 'client') {
                 return res.status(403).json({ message: 'Forbidden. Customer access required.' });
            }

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

module.exports = { protectCustomer };
