/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * FIX:
 * - Added a new public route `GET /public/:id` to correctly handle requests
 * for a single product from the storefront. This resolves the 404 error
 * seen in the logs. The new route reuses the existing `getProductById` controller.
 * - Corrected the import for `identifyTenant` to pull from the product controller
 * where it is defined.
 * - Reordered middleware for all file upload routes to ensure `identifyTenant`
 * runs BEFORE `uploadMiddleware`.
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
    getPublicCollections,
    identifyTenant
} = require('../controllers/productController');


// Import middleware from the centralized auth file.
const {
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
    identifyTenant,
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
    identifyTenant,
    getProductImagesOnly
);

// Upload new promo images for a tenant (Admin Only)
router.post(
    '/promo',
    identifyTenant,      // 1. Identify the tenant
    protect,
    isAdmin,
    uploadMiddleware,   // 2. Then handle the upload
    uploadPromoImages
);


// ================================
// 📦 PRODUCT ROUTES
// ================================

// Get all products for the public storefront for a specific tenant
router.get(
    '/public',
    identifyTenant,
    getPublicProducts
);

// *** FIX: Added this new route to handle fetching a single public product ***
// This resolves the 404 error from the product detail page.
router.get(
    '/public/:id',
    identifyTenant,
    param('id').isMongoId(),
    getProductById // Reuses the same controller logic
);


// Get all products for a client's tenant (Authenticated Users - for an admin panel)
router.get('/', identifyTenant, protect, getProducts);

// Create a new product for a tenant (Admin Only)
router.post(
    '/',
    identifyTenant,      // 1. Identify the tenant
    protect,
    isAdmin,
    uploadMiddleware,   // 2. Then handle the upload
    addProduct
);

// Get a single product by its barcode for a tenant
router.get(
    '/barcode/:barcode',
    identifyTenant,
    protect,
    param('barcode').notEmpty().withMessage('Barcode parameter cannot be empty.'),
    getProductByBarcode
);

// Get a single product by ID for a tenant (This route can be used by admin panels)
router.get(
    '/:id',
    identifyTenant,
    param('id').isMongoId(),
    getProductById
);

// Update a product for a tenant (Admin Only)
router.put(
    '/:id',
    identifyTenant,      // 1. Identify the tenant
    protect,
    isAdmin,
    param('id').isMongoId(),
    uploadMiddleware,   // 2. Then handle the upload
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
    identifyTenant,
    protectCustomer,
    param('id').isMongoId(),
    [
        body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
        body('comment').notEmpty().withMessage('Comment cannot be empty.')
    ],
    createProductReview
);


module.exports = router;
