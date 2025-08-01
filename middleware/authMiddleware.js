// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Client = require('../models/Client'); // Used for customers

/**
 * Extracts and returns the bearer token from the request headers.
 */
const getTokenFromHeader = (req) => {
    const authHeader = req.headers.authorization;
    return authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
};

/**
 * @desc    Middleware to protect staff/admin routes (Users)
 */
const protect = async (req, res, next) => {
    const token = getTokenFromHeader(req);

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    try {
        if (!req.client?.config?.jwtSecret) {
            return res.status(500).json({ message: 'Server error: Missing tenant JWT secret.' });
        }

        const decoded = jwt.verify(token, req.client.config.jwtSecret);

        const user = await User.findOne({ _id: decoded.id, tenantId: req.tenantId }).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized: User not found.' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('User Auth Error:', error.message);
        return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
};

/**
 * @desc    Middleware to authorize only admins
 */
const isAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
};

/**
 * @desc    Middleware to protect customer routes (Clients)
 */
const protectCustomer = async (req, res, next) => {
    const token = getTokenFromHeader(req);

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    try {
        if (!req.client?.config?.jwtSecret) {
            return res.status(500).json({ message: 'Server error: Missing tenant JWT secret.' });
        }

        const decoded = jwt.verify(token, req.client.config.jwtSecret);

        if (decoded.role !== 'client') {
            return res.status(403).json({ message: 'Forbidden: Customer access only.' });
        }

        const customer = await Client.findOne({ _id: decoded.id, tenantId: req.tenantId }).select('-password');

        if (!customer) {
            return res.status(401).json({ message: 'Unauthorized: Customer not found.' });
        }

        req.customer = customer;
        next();
    } catch (error) {
        console.error('Customer Auth Error:', error.message);
        return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
};

module.exports = {
    protect,
    isAdmin,
    protectCustomer,
};
