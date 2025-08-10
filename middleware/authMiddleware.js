/**
 * FILE: ./middleware/authMiddleware.js
 * DESC: This is the master authentication middleware file with robust tenant identification.
 *
 * CHANGE SUMMARY:
 * - ADDED: A new `isAuthorized` middleware function. This is a flexible function that
 * can check if a user has one of several roles (e.g., 'admin' OR 'confirmation').
 * - ADDED: A new `isSuperAdmin` middleware function. This function checks for a 
 * `SUPER_ADMIN_API_KEY` in the request headers (`x-api-key`). This is required to
 * protect the new Super Admin route in `orders.js`.
 * - ADDED: Exported both new functions so other files can import and use them.
 *
 * REQUIREMENT:
 * - You must add a `SUPER_ADMIN_API_KEY` to your .env file on the server. For example:
 * SUPER_ADMIN_API_KEY=your-very-secret-and-long-api-key
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Client = require('../models/Client');

/**
 * @desc Identifies the tenant by hostname OR header and attaches tenant data.
 */
const identifyTenant = async (req, res, next) => {
    try {
        const hostname = req.hostname;
        const tenantIdentifier = req.headers['x-tenant-id'];
        let client = null;

        if (hostname && hostname.includes('.waqti.pro')) {
            const subdomain = hostname.split('.')[0];
            client = await Client.findOne({ subdomain: subdomain }).lean();
        }

        if (!client && tenantIdentifier) {
            const isNumeric = !isNaN(parseFloat(tenantIdentifier)) && isFinite(tenantIdentifier);
            
            if (isNumeric) {
                client = await Client.findOne({ tenantId: Number(tenantIdentifier) }).lean();
            } else {
                client = await Client.findOne({ subdomain: tenantIdentifier }).lean();
            }
        }

        if (!client) {
            return res.status(404).json({ message: 'Tenant could not be identified.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }
        
        console.log('Tenant identified:', { 
            _id: client._id, 
            tenantId: client.tenantId, 
            subdomain: client.subdomain 
        });

        req.tenant = client;
        req.tenantObjectId = client._id; 
        
        if (client.config && client.config.jwtSecret) {
            req.jwtSecret = client.config.jwtSecret;
        } else {
            console.error(`CONFIG ERROR: jwtSecret is missing for tenant: ${client.tenantId || client.subdomain}.`);
            return res.status(500).json({ message: 'Server configuration error for this tenant.' });
        }

        next();
    } catch (error) {
        console.error('Tenant Identification Error:', error);
        res.status(500).json({ message: 'Server error during client identification.' });
    }
};

const getTokenFromHeader = (req) => {
    const authHeader = req.headers.authorization;
    return authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
};

/**
 * @desc     Middleware to protect staff/admin routes (Users)
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
        if (!user) return res.status(401).json({ message: 'Unauthorized: User not found for this tenant.' });

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized: Invalid or expired token.' });
    }
};

/**
 * @desc     Middleware to authorize only admins
 */
const isAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
};

/**
 * @desc Middleware to protect Super Admin routes by checking for a secret API key.
 */
const isSuperAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.SUPER_ADMIN_API_KEY) {
        next();
    } else {
        console.warn('Failed Super Admin access attempt.');
        res.status(401).json({ message: 'Unauthorized: Invalid or missing Super Admin API key.' });
    }
};

/**
 * Checks if the user's role is included in the list of allowed roles.
 * This should be used after the 'protect' middleware.
 * @param {...string} allowedRoles - A list of role strings that are allowed access (e.g., 'admin', 'confirmation').
 */
const isAuthorized = (...allowedRoles) => {
  return (req, res, next) => {
    // The 'protect' middleware should have already attached the user object to the request.
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Forbidden: User role not found.' });
    }

    // Check if the user's role is in the list of roles we've allowed for this route.
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
    }

    // If the check passes, proceed to the next function in the chain (the controller).
    next();
  };
};

/**
 * @desc     Middleware to protect customer routes
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
    isSuperAdmin,
    isAuthorized, // Export the new function
    protectCustomer
};
