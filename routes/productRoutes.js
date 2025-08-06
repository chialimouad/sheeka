/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * UPDATE: Added the `identifyTenant` middleware to all public-facing and admin
 * routes to ensure all database operations are scoped to the correct tenant.
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

// Import all necessary controller functions
const {
    getProducts,
    getProductById,
    getProductByBarcode,
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
    getPublicCollections
} = require('../controllers/productController');


// Import all necessary middleware from the centralized auth file.
const {
    identifyTenant, // <-- IMPORT THE NEW MIDDLEWARE
    protect,
    isAdmin,
    protectCustomer
} = require('../middleware/authMiddleware');


// ================================
// 🛒 COLLECTION ROUTES
// ================================

// Public route for storefronts to fetch collections for a specific tenant
router.get(
    '/collections/public',
    identifyTenant, // <-- ADD THIS
    getPublicCollections
);

// Get all collections for a client's tenant (Admin Only)
router.get('/collections', identifyTenant, protect, isAdmin, getCollections);

// Create a new collection for a tenant (Admin Only)
router.post(
    '/collections',
    identifyTenant,
    protect,
    isAdmin,
    body('name').notEmpty().withMessage('Collection name is required.'),
    addCollection
);

// Update a collection for a tenant (Admin Only)
router.put(
    '/collections/:id',
    identifyTenant,
    protect,
    isAdmin,
    param('id').isMongoId(),
    updateCollection
);

// Delete a collection for a tenant (Admin Only)
router.delete(
    '/collections/:id',
    identifyTenant,
    protect,
    isAdmin,
    param('id').isMongoId(),
    deleteCollection
);


// ================================
// 📸 PROMO IMAGES ROUTES
// ================================

// Get all promo images for a tenant (Publicly accessible for storefronts)
router.get(
    '/promo',
    identifyTenant, // <-- ADD THIS
    getProductImagesOnly
);

// Upload new promo images for a tenant (Admin Only)
router.post(
    '/promo',
    identifyTenant,
    protect,
    isAdmin,
    uploadMiddleware,
    uploadPromoImages
);


// ================================
// 📦 PRODUCT ROUTES
// ================================

// Get all products for the public storefront for a specific tenant
router.get(
    '/public',
    identifyTenant, // <-- ADD THIS
    getPublicProducts
);

// Get all products for a client's tenant (Authenticated Users - for an admin panel)
router.get('/', identifyTenant, protect, getProducts);

// Create a new product for a tenant (Admin Only)
router.post(
    '/',
    identifyTenant,
    protect,
    isAdmin,
    uploadMiddleware,
    addProduct
);

// Get a single product by its barcode for a tenant
router.get(
    '/barcode/:barcode',
    identifyTenant, // <-- ADD THIS
    protect,
    param('barcode').notEmpty().withMessage('Barcode parameter cannot be empty.'),
    getProductByBarcode
);

// Get a single product by ID for a tenant (Publicly accessible)
router.get(
    '/:id',
    identifyTenant, // <-- ADD THIS
    param('id').isMongoId(),
    getProductById
);

// Update a product for a tenant (Admin Only)
router.put(
    '/:id',
    identifyTenant,
    protect,
    isAdmin,
    param('id').isMongoId(),
    uploadMiddleware,
    updateProduct
);

// Delete a product for a tenant (Admin Only)
router.delete(
    '/:id',
    identifyTenant,
    protect,
    isAdmin,
    param('id').isMongoId(),
    deleteProduct
);

// ================================
// ⭐ REVIEW ROUTES
// ================================

// Create a new review for a product (which belongs to a tenant)
router.post(
    '/:id/reviews',
    identifyTenant, // <-- ADD THIS
    protectCustomer,
    param('id').isMongoId(),
    [
        body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
        body('comment').notEmpty().withMessage('Comment cannot be empty.')
    ],
    createProductReview
);


module.exports = router;
