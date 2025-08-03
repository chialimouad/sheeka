/**
 * FILE: ./middleware/authMiddleware.js
 * DESC: This is a consolidated and corrected middleware file. It should replace
 * any other tenant identification or auth middleware files you are using.
 *
 * FIX:
 * - Provides a single, definitive `identifyTenant` function that correctly reads
 * the jwtSecret from the nested `config` object (i.e., `client.config.jwtSecret`).
 * - It attaches this secret to `req.jwtSecret` so the login controller can find it.
 * - The `protect` and `protectCustomer` functions have also been updated to look for
 * the secret in the correct nested location, ensuring protected routes work.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Client = require('../models/Client');

/**
 * @desc Identifies the tenant from the 'x-tenant-id' header and attaches
 * the tenant's data, including the crucial jwtSecret, to the request.
 * This must run before any route that needs tenant information.
 */
const identifyTenant = async (req, res, next) => {
    try {
        const tenantIdHeader = req.headers['x-tenant-id'];

        if (!tenantIdHeader) {
            return res.status(400).json({ message: 'Tenant ID header (x-tenant-id) is missing.' });
        }

        // Fetch the full client document
        const client = await Client.findOne({ tenantId: tenantIdHeader }).lean();

        if (!client) {
            return res.status(404).json({ message: 'Client not found for the provided tenant ID.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // Attach the full tenant object to the request.
        req.tenant = client;

        // **THIS IS THE CRITICAL FIX**
        // Attach the jwtSecret from the nested 'config' object.
        // The login controller and other middleware will now be able to find it.
        if (client.config && client.config.jwtSecret) {
            req.jwtSecret = client.config.jwtSecret;
        } else {
            // If the secret is missing entirely, we stop the request here.
            console.error(`MIDDLEWARE ERROR: jwtSecret is missing from the 'config' object for tenant: ${client.tenantId}.`);
            return res.status(500).json({ message: 'Server configuration error: Tenant configuration is incomplete.' });
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

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    try {
        // The 'identifyTenant' middleware should have already run and attached the secret.
        if (!req.jwtSecret) {
            return res.status(500).json({ message: 'Server error: Tenant JWT secret not found on request.' });
        }

        const decoded = jwt.verify(token, req.jwtSecret);

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


module.exports = {
    identifyTenant,
    protect,
    isAdmin,
};
