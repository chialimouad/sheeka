/**
 * FILE: ./middleware/authMiddleware.js
 * DESC: Centralized authentication and authorization middleware.
 *
 * FIX:
 * - Updated the `protect` and `protectCustomer` functions to correctly access the
 * jwtSecret from the nested `config` object (`req.tenant.config.jwtSecret`).
 * - This aligns all middleware with your database structure, ensuring that both
 * public routes (like /login) and protected routes can correctly find and
 * use the tenant's JWT secret.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // For staff/admin users
const Client = require('../models/Client'); // For tenants/customers

/**
 * @desc Identifies the tenant from the request, attaching tenant data.
 */
const identifyTenant = async (req, res, next) => {
    let client;
    try {
        const hostname = req.hostname;
        const tenantIdHeader = req.headers['x-tenant-id'];

        if (hostname) {
            client = await Client.findOne({ customDomain: hostname }).lean();
        }

        if (!client && tenantIdHeader) {
            client = await Client.findOne({ tenantId: tenantIdHeader }).lean();
        }

        if (!client) {
            return res.status(404).json({ message: 'Tenant not found. Cannot process request.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        req.tenant = client;
        next();
    } catch (error) {
        console.error('Tenant Identification Middleware Error:', error);
        res.status(500).json({ message: 'Server error during tenant identification.' });
    }
};

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
        // This now correctly checks for the secret inside the nested config object.
        if (!req.tenant?.config?.jwtSecret) {
            return res.status(500).json({ message: 'Server error: Missing tenant JWT secret.' });
        }

        const decoded = jwt.verify(token, req.tenant.config.jwtSecret);

        const user = await User.findOne({ _id: decoded.id, tenantId: req.tenant.tenantId }).select('-password');

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
        // This also now correctly checks for the secret inside the nested config object.
        if (!req.tenant?.config?.jwtSecret) {
            return res.status(500).json({ message: 'Server error: Missing tenant JWT secret.' });
        }

        const decoded = jwt.verify(token, req.tenant.config.jwtSecret);

        if (decoded.role !== 'client') {
            return res.status(403).json({ message: 'Forbidden: Customer access only.' });
        }

        const customer = await Client.findOne({ _id: decoded.id, tenantId: req.tenant.tenantId }).select('-password');

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
    identifyTenant,
    protect,
    isAdmin,
    protectCustomer,
};
