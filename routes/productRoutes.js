/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * FIX:
 * - Removed the `protect` middleware from the `GET /` and `GET /collections` routes.
 * This makes them public, allowing the storefront to fetch product and category
 * data for all visitors without requiring them to be logged in. This resolves the 401 Unauthorized error.
 * - All other security rules remain the same: data modification routes are admin-only.
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const productController = require('../controllers/productController');

// Import all necessary middleware from the centralized auth file.
const {
    protect,
    isAdmin,
    protectCustomer
} = require('../middleware/authMiddleware');


// ================================
// 🛒 COLLECTION ROUTES
// ================================

// Get all collections for a client (Publicly accessible for storefronts)
// FIX: Removed 'protect' and 'isAdmin' to make this route public.
router.get('/collections', productController.getCollections);

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

// Get all products for a client (Publicly accessible for storefronts)
// FIX: Removed 'protect' middleware to make the main product listing public.
router.get('/', productController.getProducts);

// Create a new product (Admin Only)
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
    protectCustomer, 
    param('id').isMongoId(),
    [
        body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
        body('comment').notEmpty().withMessage('Comment cannot be empty.')
    ],
    productController.createProductReview
);


module.exports = router;
