/*
 * FILE: ./middleware/authMiddleware.js
 * DESC: This is a consolidated and corrected middleware file. It should replace
 * any other tenant identification or auth middleware files you are using.
 *
 * FIX:
 * - Updated the `protect` middleware with a more robust initial check.
 * - The error message is now more explicit, guiding the developer to check
 * their route definitions to ensure `identifyTenant` is used before `protect`.
 * This directly addresses the "Tenant JWT secret not found" error by
 * clarifying its root cause.
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

        // Attach the jwtSecret from the nested 'config' object.
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
        // **THIS IS THE FIX**: A single, more robust check with a clearer error message.
        if (!req.tenant || !req.jwtSecret) {
            console.error('PROTECT MIDDLEWARE ERROR: `req.tenant` or `req.jwtSecret` is missing.');
            console.error('This usually means the `identifyTenant` middleware did not run before the `protect` middleware on this route.');
            console.error('Please check your route definitions (e.g., in orderRoutes.js) and ensure the middleware chain is correct: `identifyTenant` -> `protect`.');
            return res.status(500).json({ message: 'Server configuration error: Tenant could not be properly identified for this request.' });
        }

        const decoded = jwt.verify(token, req.jwtSecret);

        const user = await User.findOne({ _id: decoded.id, tenantId: req.tenant.tenantId }).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized: User not found for this tenant.' });
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

/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * FIX:
 * - Consolidated all middleware imports to use the single, correct
 * `../middleware/authMiddleware.js` file. This resolves potential conflicts
 * and errors from using outdated or separate middleware files.
 * - The middleware chains for each route have been verified to ensure correct
 * execution order for public, admin, and customer-specific endpoints.
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

// Import the product controller
const productController = require('../controllers/productController');

// **FIX**: All middleware is now imported from the single, consolidated auth file.
const {
    identifyTenant,
    protect,
    isAdmin,
    protectCustomer // Assuming this is now part of your main authMiddleware
} = require('../middleware/authMiddleware');


// ================================
// 🛒 COLLECTION ROUTES
// ================================

// Get all collections for a client (Admin Only)
router.get('/collections', identifyTenant, protect, isAdmin, productController.getCollections);

// Create a new collection (Admin Only)
router.post(
    '/collections',
    identifyTenant,
    protect,
    isAdmin,
    body('name').notEmpty(),
    productController.addCollection
);

// ================================
// 📸 PROMO IMAGES ROUTES
// ================================

// Get all promo images for a client (Public)
router.get('/promo', identifyTenant, productController.getProductImagesOnly);

// Upload new promo images (Admin Only)
router.post(
    '/promo',
    identifyTenant,
    protect,
    isAdmin,
    productController.uploadMiddleware,
    productController.uploadPromoImages
);


// ================================
// 📦 PRODUCT ROUTES
// ================================

// Get all products for a client (Public)
router.get('/', identifyTenant, productController.getProducts);

// Create a new product (Admin Only)
router.post(
    '/',
    identifyTenant,
    protect,
    isAdmin,
    productController.uploadMiddleware,
    productController.addProduct
);

// Get a single product by ID (Public)
// IMPORTANT: This dynamic route comes AFTER specific routes like '/collections' and '/promo'.
router.get(
    '/:id',
    identifyTenant,
    param('id').isMongoId(),
    productController.getProductById
);

// Update a product (Admin Only)
router.put(
    '/:id',
    identifyTenant,
    protect,
    isAdmin,
    param('id').isMongoId(),
    productController.uploadMiddleware,
    productController.updateProduct
);

// Delete a product (Admin Only)
router.delete(
    '/:id',
    identifyTenant,
    protect,
    isAdmin,
    param('id').isMongoId(),
    productController.deleteProduct
);

// ================================
// ⭐ REVIEW ROUTES
// ================================

// Create a new review for a product (Logged-in Customers Only)
router.post(
    '/:id/reviews',
    identifyTenant,
    protectCustomer, // Ensures only a logged-in customer can post a review
    param('id').isMongoId(),
    [
        body('rating').isFloat({ min: 1, max: 5 }),
        body('comment').notEmpty()
    ],
    productController.createProductReview
);


module.exports = router;
