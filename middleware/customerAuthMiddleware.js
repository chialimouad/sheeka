// middleware/customerAuthMiddleware.js

const jwt = require('jsonwebtoken');
const Customer = require('../models/Client');

/**
 * @desc    Middleware to protect customer routes using JWT authentication.
 *          Validates token and loads customer data.
 */
const protectCustomer = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Ensure tenant is resolved before this middleware
        if (!req.client?.config?.jwtSecret) {
            return res.status(500).json({ message: 'Server error: Missing client JWT secret.' });
        }

        // Decode JWT with the tenant-specific secret
        const decoded = jwt.verify(token, req.client.config.jwtSecret);

        if (decoded.role !== 'client') {
            return res.status(403).json({ message: 'Forbidden: Client token required.' });
        }

        // Validate customer belongs to the tenant
        const customer = await Customer.findOne({
            _id: decoded.id,
            tenantId: req.tenantId,
        }).select('-password');

        if (!customer) {
            return res.status(401).json({ message: 'Unauthorized: Customer not found.' });
        }

        req.customer = customer;
        next();
    } catch (error) {
        console.error('Customer token verification failed:', error.message);
        return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
};

module.exports = { protectCustomer };
