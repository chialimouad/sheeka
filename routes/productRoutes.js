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
