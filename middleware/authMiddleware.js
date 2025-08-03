/**
 * FILE: ./middleware/authMiddleware.js
 * DESC: This is the master authentication middleware file, now with subdomain support.
 *
 * NEW FEATURE:
 * - The `identifyTenant` function is now much more powerful. It first tries to
 * identify the tenant by the request's hostname (e.g., 'client1.waqti.pro').
 * - To make this work, your `Client` model in the database MUST have a field
 * named `subdomain` that stores the unique part (e.g., 'client1').
 * - If it can't find a tenant by hostname, it falls back to checking for the
 * `x-tenant-id` header. This ensures your existing dashboard API calls still work.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Client = require('../models/Client');

/**
 * @desc Identifies the tenant by hostname OR header and attaches tenant data.
 */
const identifyTenant = async (req, res, next) => {
    try {
        const hostname = req.hostname; // e.g., 'client1.waqti.pro'
        const tenantIdHeader = req.headers['x-tenant-id'];
        let client = null;

        // 1. Try to find the tenant by subdomain first.
        if (hostname && hostname.endsWith('.waqti.pro')) {
            const subdomain = hostname.split('.')[0]; // Extracts 'client1'
            // Your Client model needs a 'subdomain' field for this query to work.
            client = await Client.findOne({ subdomain: subdomain }).lean();
        }

        // 2. If not found by subdomain, fall back to the header (for API calls).
        if (!client && tenantIdHeader) {
            client = await Client.findOne({ tenantId: tenantIdHeader }).lean();
        }

        // 3. If no tenant is found by either method, deny access.
        if (!client) {
            return res.status(404).json({ message: 'Tenant could not be identified.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // 4. Success! Attach tenant data to the request.
        req.tenant = client;
        if (client.config && client.config.jwtSecret) {
            req.jwtSecret = client.config.jwtSecret;
        } else {
            console.error(`CONFIG ERROR: jwtSecret is missing for tenant: ${client.tenantId}.`);
            return res.status(500).json({ message: 'Server configuration error for this tenant.' });
        }

        next();
    } catch (error) {
        console.error('Tenant Identification Error:', error);
        res.status(500).json({ message: 'Server error during client identification.' });
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
    if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided.' });

    try {
        if (!req.tenant || !req.jwtSecret) {
            console.error('PROTECT ERROR: `identifyTenant` must run first.');
            return res.status(500).json({ message: 'Server configuration error.' });
        }
        const decoded = jwt.verify(token, req.jwtSecret);
        const user = await User.findOne({ _id: decoded.id, tenantId: req.tenant.tenantId }).select('-password');
        if (!user) return res.status(401).json({ message: 'Unauthorized: User not found.' });
        req.user = user;
        next();
    } catch (error) {
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
 * @desc    Middleware to protect customer routes
 */
const protectCustomer = async (req, res, next) => {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided.' });

    try {
        if (!req.tenant || !req.jwtSecret) {
            console.error('PROTECT_CUSTOMER_ERROR: `identifyTenant` must run first.');
            return res.status(500).json({ message: 'Server configuration error.' });
        }
        const decoded = jwt.verify(token, req.jwtSecret);
        if (decoded.role !== 'customer') return res.status(403).json({ message: 'Forbidden: Customer access only.' });
        const customer = await Client.findOne({ _id: decoded.id, tenantId: req.tenant.tenantId });
        if (!customer) return res.status(401).json({ message: 'Unauthorized: Customer not found.' });
        req.customer = customer;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
};


module.exports = {
    identifyTenant,
    protect,
    isAdmin,
    protectCustomer
};
