/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * FIX:
 * - Re-enabled the `protectCustomer` middleware on the review creation route.
 * This assumes `protectCustomer` is correctly defined and exported from your auth middleware.
 * - Added `update` and `delete` routes for collections.
 * - Ensured all admin-only routes are protected by both `protect` and `isAdmin` middleware.
 * - Maintained the `protect` middleware on the GET /products route to ensure only authenticated
 * users of a tenant can view its products.
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const productController = require('../controllers/productController');

// Import all necessary middleware from the centralized auth file.
// The global `identifyTenant` middleware in server.js handles req.tenantId.
const {
    protect,
    isAdmin,
    protectCustomer // Ensure this is defined and exported from authMiddleware.js
} = require('../middleware/authMiddleware');


// ================================
// 🛒 COLLECTION ROUTES
// ================================

// Get all collections for a client (Admin Only)
router.get('/collections', protect, isAdmin, productController.getCollections);

// Create a new collection (Admin Only)
router.post(
    '/collections',
    protect,
    isAdmin,
    body('name').notEmpty().withMessage('Collection name is required.'),
    productController.addCollection
);

// Update a collection (Admin Only)
router.put(
    '/collections/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    productController.updateCollection
);

// Delete a collection (Admin Only)
router.delete(
    '/collections/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    productController.deleteCollection
);


// ================================
// 📸 PROMO IMAGES ROUTES
// =========================

// Get all promo images for a client (Publicly accessible for storefronts)
router.get('/promo', productController.getProductImagesOnly);

// Upload new promo images (Admin Only)
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

// Get all products for a client (Authenticated Users)
// This route is protected to ensure req.user is available for tenant identification.
router.get('/', protect, productController.getProducts);

// Create a new product (Admin Only)
router.post(
    '/',
    protect,
    isAdmin,
    productController.uploadMiddleware,
    productController.addProduct
);

// Get a single product by ID (Publicly accessible for storefronts)
// This dynamic route must come AFTER specific routes like '/collections' and '/promo'.
router.get(
    '/:id',
    param('id').isMongoId(),
    productController.getProductById
);

// Update a product (Admin Only)
router.put(
    '/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    productController.uploadMiddleware,
    productController.updateProduct
);

// Delete a product (Admin Only)
router.delete(
    '/:id',
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
    protectCustomer, // FIX: Re-enabled. Ensures only logged-in customers can post reviews.
    param('id').isMongoId(),
    [
        body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
        body('comment').notEmpty().withMessage('Comment cannot be empty.')
    ],
    productController.createProductReview
);


module.exports = router;
