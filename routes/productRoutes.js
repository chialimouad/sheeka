/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * --- MULTI-TENANCY STRATEGY ---
 * 1.  Frontend Identification: The client-side code identifies the tenant from the URL's subdomain (e.g., 'zara' from 'zara.waqti.pro').
 * 2.  Tenant Header: The frontend sends this identifier in a custom HTTP header, `x-tenant-id`, with every API request.
 * 3.  Backend Middleware: A global middleware (assumed to be configured in your main server.js file, e.g., `identifyTenant`) reads the `x-tenant-id` header. If valid, it fetches the corresponding tenant's details (like their database ID) and attaches it to the request object (e.g., as `req.tenantId`).
 * 4.  Controller Logic: Each controller function then uses `req.tenantId` to scope its database queries, ensuring it only fetches data for that specific tenant (e.g., `Product.find({ tenantId: req.tenantId })`).
 * 5.  Public vs. Protected Routes:
 * - Public routes (e.g., viewing products) should be open and rely on the `x-tenant-id` header for data scoping.
 * - Protected routes (e.g., creating/updating products) should require admin authentication (`protect`, `isAdmin`) in addition to the tenant identification.
 *
 * --- FIX APPLIED ---
 * - Removed the `protect` middleware from the `GET /` route. This makes the main product listing
 * publicly accessible to all visitors of a tenant's storefront, which is the expected behavior.
 * The `identifyTenant` global middleware will still ensure the correct products are shown based on the `x-tenant-id` header.
 * - Kept `protect` and `isAdmin` on all routes that modify data (create, update, delete) to ensure they remain secure.
 * - Added `update` and `delete` routes for collections for full CRUD functionality.
 * - Re-enabled `protectCustomer` on the review creation route to ensure only logged-in customers can post reviews.
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const productController = require('../controllers/productController');

// Import middleware for authentication and authorization.
// The global `identifyTenant` middleware in server.js should handle attaching `req.tenantId`.
const {
    protect,
    isAdmin,
    protectCustomer
} = require('../middleware/authMiddleware');


// ================================
// 🛒 COLLECTION ROUTES
// ================================

// GET all collections for the current tenant (Admin Only)
router.get('/collections', protect, isAdmin, productController.getCollections);

// POST a new collection for the current tenant (Admin Only)
router.post(
    '/collections',
    protect,
    isAdmin,
    body('name').notEmpty().withMessage('Collection name is required.'),
    productController.addCollection
);

// PUT (update) a specific collection (Admin Only)
router.put(
    '/collections/:id',
    protect,
    isAdmin,
    param('id').isMongoId().withMessage('Invalid collection ID.'),
    productController.updateCollection
);

// DELETE a specific collection (Admin Only)
router.delete(
    '/collections/:id',
    protect,
    isAdmin,
    param('id').isMongoId().withMessage('Invalid collection ID.'),
    productController.deleteCollection
);


// ================================
// 📸 PROMO IMAGES ROUTES
// ================================

// GET all promo images for the current tenant (Public)
router.get('/promo', productController.getProductImagesOnly);

// POST new promo images (Admin Only)
router.post(
    '/promo',
    protect,
    isAdmin,
    productController.uploadMiddleware,
    productController.uploadPromoImages
);


// ================================
// 📦 PRODUCT ROUTES
// ================================

// GET all products for the current tenant (Public)
// FIX: Removed `protect` middleware. This endpoint should be public so visitors
// can see the products on the storefront. The tenant is identified via the
// `x-tenant-id` header and a global middleware.
router.get('/', productController.getProducts);

// POST a new product (Admin Only)
router.post(
    '/',
    protect,
    isAdmin,
    productController.uploadMiddleware,
    productController.addProduct
);

// GET a single product by ID (Public)
// This dynamic route must come AFTER specific routes like '/collections' and '/promo'.
router.get(
    '/:id',
    param('id').isMongoId().withMessage('Invalid product ID.'),
    productController.getProductById
);

// PUT (update) a product (Admin Only)
router.put(
    '/:id',
    protect,
    isAdmin,
    param('id').isMongoId().withMessage('Invalid product ID.'),
    productController.uploadMiddleware,
    productController.updateProduct
);

// DELETE a product (Admin Only)
router.delete(
    '/:id',
    protect,
    isAdmin,
    param('id').isMongoId().withMessage('Invalid product ID.'),
    productController.deleteProduct
);

// ================================
// ⭐ REVIEW ROUTES
// ================================

// POST a new review for a product (Logged-in Customers Only)
router.post(
    '/:id/reviews',
    protectCustomer, // Ensures only authenticated customers of the tenant can post.
    param('id').isMongoId().withMessage('Invalid product ID.'),
    [
        body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
        body('comment').notEmpty().withMessage('Comment cannot be empty.')
    ],
    productController.createProductReview
);


module.exports = router;
