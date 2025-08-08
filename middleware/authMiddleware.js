/**
 * FILE: ./middleware/authMiddleware.js
 * DESC: This is the master authentication middleware file with robust tenant identification.
 *
 * FIX:
 * - The `identifyTenant` function has been upgraded to handle both numeric IDs
 * and string-based subdomains when checking the `x-tenant-id` header.
 * - It now checks if the header value is a number. If it is, it queries by the
 * `tenantId` field. If it's not a number (e.g., "mouad"), it queries by the
 * `subdomain` field.
 * - **CRITICAL FIX**: It now explicitly attaches the client's MongoDB `_id` to the
 * request as `req.tenantObjectId`. This resolves the "Cast to ObjectId failed"
 * error by providing the correct data type for querying related collections
 * like SiteConfig, Products, and Orders.
 * - **FIX**: Removed the strict JWT tenantId check from the `protect` middleware.
 * The subsequent `User.findOne` query already validates that the user belongs
 * to the correct tenant, making the explicit check redundant and preventing
 * errors with tokens that may not contain a `tenantId` in their payload.
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

        // 1. Try to find the tenant by subdomain from the hostname.
        if (hostname && hostname.includes('.waqti.pro')) {
            const subdomain = hostname.split('.')[0];
            client = await Client.findOne({ subdomain: subdomain }).lean();
        }

        // 2. If not found, fall back to the 'x-tenant-id' header.
        if (!client && tenantIdentifier) {
            const isNumeric = !isNaN(parseFloat(tenantIdentifier)) && isFinite(tenantIdentifier);
            
            if (isNumeric) {
                // If it's a number, query by the numeric tenantId field.
                client = await Client.findOne({ tenantId: Number(tenantIdentifier) }).lean();
            } else {
                // If it's a string (like a subdomain), query by the subdomain field.
                client = await Client.findOne({ subdomain: tenantIdentifier }).lean();
            }
        }

        // 3. If no tenant is found, deny access.
        if (!client) {
            return res.status(404).json({ message: 'Tenant could not be identified.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // 4. Success! Attach tenant data to the request.
        req.tenant = client;
        // **FIX**: Add the MongoDB ObjectId for querying related collections.
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


/**
 * Extracts and returns the bearer token from the request headers.
 */
const getTokenFromHeader = (req) => {
    const authHeader = req.headers.authorization;
    return authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
};

/**
 * @desc    Middleware to protect staff/admin routes (Users)
 */
const protect = async (req, res, next) => {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided.' });

    try {
        if (!req.tenant || !req.jwtSecret) {
            console.error('PROTECT ERROR: `identifyTenant` must run first.');
            return res.status(500).json({ message: 'Server configuration error.' });
        }
        
        // Verify the token with the secret of the tenant identified by the header.
        const decoded = jwt.verify(token, req.jwtSecret);

        // Find the user associated with the token.
        // This query implicitly ensures the user belongs to the correct tenant,
        // making an explicit check against the JWT payload unnecessary and more robust.
        const user = await User.findOne({ _id: decoded.id, tenantId: req.tenant.tenantId }).select('-password');
        if (!user) return res.status(401).json({ message: 'Unauthorized: User not found for this tenant.' });

        req.user = user;
        next();
    } catch (error) {
        // If the error is from JWT (e.g., signature invalid, expired), it will be caught here.
        return res.status(401).json({ message: 'Unauthorized: Invalid or expired token.' });
    }
};

/**
 * @desc    Middleware to authorize only admins
 */
const isAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
};

/**
 * @desc    Middleware to protect customer routes
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
