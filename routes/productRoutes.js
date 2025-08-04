/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * =======================================================================================
 * FIXED:
 * - The main product listing route `GET /` is now public to allow storefronts to display products.
 * - The collections listing route `GET /collections` is now public for the same reason.
 * - All admin-only routes (POST, PUT, DELETE) remain protected by `protect` and `isAdmin`.
 * - The admin dashboard will continue to work because its authenticated requests to the now-public
 * routes will still succeed, and its protected requests will still be authenticated.
 * =======================================================================================
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
    protectCustomer
} = require('../middleware/authMiddleware');


// ================================
// 🛒 COLLECTION ROUTES
// ================================

// FIX: This route is now PUBLIC so storefronts can display collections/categories.
// The isAdmin and protect middleware have been removed.
// The admin panel will still be able to fetch this data without issues.
router.get('/collections', productController.getCollections);

// Create a new collection (Admin Only - STILL PROTECTED)
router.post(
    '/collections',
    protect,
    isAdmin,
    body('name').notEmpty().withMessage('Collection name is required.'),
    productController.addCollection
);

// Update a collection (Admin Only - STILL PROTECTED)
router.put(
    '/collections/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    productController.updateCollection
);

// Delete a collection (Admin Only - STILL PROTECTED)
router.delete(
    '/collections/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    productController.deleteCollection
);


// ================================
// 📸 PROMO IMAGES ROUTES
// ================================

// Get all promo images for a client (Publicly accessible for storefronts)
router.get('/promo', productController.getProductImagesOnly);

// Upload new promo images (Admin Only - STILL PROTECTED)
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

// FIX: This route is now PUBLIC so storefronts can display products.
// The `protect` middleware has been removed. The global `identifyTenant`
// middleware is sufficient for fetching tenant-specific products.
// The admin panel will still work perfectly with this route.
router.get('/', productController.getProducts);

// Create a new product (Admin Only - STILL PROTECTED)
router.post(
    '/',
    protect,
    isAdmin,
    productController.uploadMiddleware,
    productController.addProduct
);

// Get a single product by ID (Publicly accessible for storefronts)
router.get(
    '/:id',
    param('id').isMongoId(),
    productController.getProductById
);

// Update a product (Admin Only - STILL PROTECTED)
router.put(
    '/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    productController.uploadMiddleware,
    productController.updateProduct
);

// Delete a product (Admin Only - STILL PROTECTED)
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
    protectCustomer, // Ensures only logged-in customers can post reviews.
    param('id').isMongoId(),
    [
        body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
        body('comment').notEmpty().withMessage('Comment cannot be empty.')
    ],
    productController.createProductReview
);


module.exports = router;
