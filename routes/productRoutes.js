// routes/productRoutes.js

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

// Import the refactored controller
const productController = require('../controllers/productController');

// Import the necessary middleware for security and tenant identification
const { identifyTenant } = require('../middleware/tenantMiddleware');
const { protect, isAdmin } = require('../middleware/authMiddleware');
// A separate middleware to protect routes accessible only by logged-in customers
const { protectCustomer } = require('../middleware/customerAuthMiddleware');

// ================================
// 🛒 COLLECTION ROUTES
// ================================
// **FIX**: These specific routes are placed before any dynamic '/:id' routes.

// Get all collections for a client (Public)
// Note: This route was changed from public to protected to align with the others.
// If it should be public, you can remove the 'protect' and 'isAdmin' middleware.
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
// **FIX**: These specific routes are also placed before any dynamic '/:id' routes.

// Get all promo images for a client (Public)
router.get('/promo', identifyTenant, productController.getProductImagesOnly);

// Upload new promo images (Admin Only)
router.post(
    '/promo',
    identifyTenant,
    protect,
    isAdmin,
    productController.uploadMiddleware, // Use the same dynamic uploader
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
    productController.uploadMiddleware, // Use the dynamic, tenant-aware uploader
    productController.addProduct
);

// **IMPORTANT**: Dynamic routes with parameters like '/:id' must come AFTER all specific string routes.
// Get a single product by ID (Public)
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
    productController.uploadMiddleware, // Handles potential new image uploads
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
    body('rating').isFloat({ min: 1, max: 5 }),
    body('comment').notEmpty(),
    productController.createProductReview
);


module.exports = router;
