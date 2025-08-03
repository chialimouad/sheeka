/**
 * FILE: ./middleware/authMiddleware.js
 * DESC: Centralized authentication and authorization middleware.
 *
 * UPDATE:
 * - Merged the new, more granular middleware for protecting different user types
 * (staff vs. customers) with the existing robust tenant identification logic.
 * - Kept the `identifyTenant` function, which is crucial for a multi-tenant setup.
 * It can identify tenants by hostname or by a request header.
 * - Added the `getTokenFromHeader` helper function for cleaner token extraction.
 * - Added the `protectCustomer` middleware to specifically handle customer authentication.
 * - Renamed `admin` to `isAdmin` for clarity as requested.
 * - Adjusted the new middleware to work with the `req.tenant` object that `identifyTenant`
 * attaches to the request, ensuring compatibility.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // For staff/admin users
const Client = require('../models/Client'); // For tenants/customers

/**
 * @desc Identifies the tenant from the request, attaching tenant data.
 * This middleware is critical and must run before any protected routes.
 * It first attempts to identify the tenant by the request hostname. If that fails,
 * it falls back to looking for an 'x-tenant-id' header.
 */
const identifyTenant = async (req, res, next) => {
    let client;
    try {
        const hostname = req.hostname;
        const tenantIdHeader = req.headers['x-tenant-id'];

        // 1. Try to find the tenant by their custom domain (hostname)
        if (hostname) {
            client = await Client.findOne({ customDomain: hostname }).lean();
        }

        // 2. If not found by hostname, fall back to the tenant ID header
        if (!client && tenantIdHeader) {
            client = await Client.findOne({ tenantId: tenantIdHeader }).lean();
        }

        // 3. If no tenant could be identified, deny access.
        if (!client) {
            return res.status(404).json({ message: 'Tenant not found. Cannot process request.' });
        }

        // 4. Check if the tenant's account is active.
        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // 5. Success! Attach tenant info to the request for other middleware/controllers.
        req.tenant = client; // Attach the full tenant object

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
        // This relies on `identifyTenant` running first to attach `req.tenant`
        if (!req.tenant?.jwtSecret) {
            return res.status(500).json({ message: 'Server error: Missing tenant JWT secret.' });
        }

        const decoded = jwt.verify(token, req.tenant.jwtSecret);

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
        // This also relies on `identifyTenant` running first
        if (!req.tenant?.jwtSecret) {
            return res.status(500).json({ message: 'Server error: Missing tenant JWT secret.' });
        }

        const decoded = jwt.verify(token, req.tenant.jwtSecret);

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
