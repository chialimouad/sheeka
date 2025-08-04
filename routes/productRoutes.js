/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * --- FIX APPLIED (v2) ---
 * - The `GET /collections` route is now public (removed `protect` and `isAdmin` middleware).
 * This is critical for the public storefront to be able to fetch and display category/collection information to all visitors.
 * - All other security rules remain the same: data modification routes are admin-only, and product/collection lists are public.
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const productController = require('../controllers/productController');

// Import middleware for authentication and authorization.
const {
    protect,
    isAdmin,
    protectCustomer
} = require('../middleware/authMiddleware');


// ================================
// 🛒 COLLECTION ROUTES
// ================================

// GET all collections for the current tenant (Public)
// FIX: This route must be public for the storefront to display categories.
router.get('/collections', productController.getCollections);

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
    protectCustomer,
    param('id').isMongoId().withMessage('Invalid product ID.'),
    [
        body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
        body('comment').notEmpty().withMessage('Comment cannot be empty.')
    ],
    productController.createProductReview
);


module.exports = router;
