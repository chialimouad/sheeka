/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * FIX:
 * - Added a new public route `GET /collections/public` for storefronts to fetch collections
 * without authentication, using the `getPublicCollections` controller.
 * - Imported the `getPublicCollections` function from the controller.
 * - Ensured all admin and protected routes remain unchanged.
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

// Import all necessary controller functions
const {
    getProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,
    createProductReview,
    getCollections,
    addCollection,
    updateCollection,
    deleteCollection,
    getProductImagesOnly,
    uploadPromoImages,
    uploadMiddleware,
    getPublicProducts,
    getPublicCollections // Import the new public collections function
} = require('../controllers/productController');


// Import all necessary middleware from the centralized auth file.
const {
    protect,
    isAdmin,
    protectCustomer
} = require('../middleware/authMiddleware');


// ================================
// 🛒 COLLECTION ROUTES
// ================================

// NEW: Public route for storefronts to fetch collections
router.get('/collections/public', getPublicCollections);

// Get all collections for a client (Admin Only)
router.get('/collections', protect, isAdmin, getCollections);

// Create a new collection (Admin Only)
router.post(
    '/collections',
    protect,
    isAdmin,
    body('name').notEmpty().withMessage('Collection name is required.'),
    addCollection
);

// Update a collection (Admin Only)
router.put(
    '/collections/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    updateCollection
);

// Delete a collection (Admin Only)
router.delete(
    '/collections/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    deleteCollection
);


// ================================
// 📸 PROMO IMAGES ROUTES
// =========================

// Get all promo images for a client (Publicly accessible for storefronts)
router.get('/promo', getProductImagesOnly);

// Upload new promo images (Admin Only)
router.post(
    '/promo',
    protect,
    isAdmin,
    uploadMiddleware,
    uploadPromoImages
);


// ================================
// 📦 PRODUCT ROUTES
// ================================

// Get all products for the public storefront (Publicly Accessible)
router.get('/public', getPublicProducts);

// Get all products for a client (Authenticated Users - for an admin panel)
router.get('/', protect, getProducts);

// Create a new product (Admin Only)
router.post(
    '/',
    protect,
    isAdmin,
    uploadMiddleware,
    addProduct
);

// Get a single product by ID (Publicly accessible for storefronts)
router.get(
    '/:id',
    param('id').isMongoId(),
    getProductById
);

// Update a product (Admin Only)
router.put(
    '/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    uploadMiddleware,
    updateProduct
);

// Delete a product (Admin Only)
router.delete(
    '/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    deleteProduct
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
    createProductReview
);


module.exports = router;
