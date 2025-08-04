/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * FIX:
 * - Removed the redundant `identifyTenant` middleware from all route definitions.
 * This middleware is already applied globally to the `/products` route group
 * in `server.js`, and applying it twice was causing a `400 Bad Request` error.
 * - Removed the duplicated middleware code that was pasted at the top of this file.
 * - Temporarily commented out the `protectCustomer` middleware in the review route.
 * This middleware was causing a server crash because it is not yet exported from
 * your main `authMiddleware.js` file. A detailed note has been added for the
 * permanent fix.
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

// Import the product controller
const productController = require('../controllers/productController');

// All middleware is now correctly imported from the single, consolidated auth file.
// NOTE: We no longer need to import `identifyTenant` here as it's handled in server.js
const {
    protect,
    isAdmin,
    protectCustomer // This will be undefined if not exported from authMiddleware.js
} = require('../middleware/authMiddleware');


// ================================
// 🛒 COLLECTION ROUTES
// ================================

// Get all collections for a client (Admin Only)
// FIX: Removed redundant `identifyTenant`
router.get('/collections', protect, isAdmin, productController.getCollections);

// Create a new collection (Admin Only)
// FIX: Removed redundant `identifyTenant`
router.post(
    '/collections',
    protect,
    isAdmin,
    body('name').notEmpty(),
    productController.addCollection
);

// ================================
// 📸 PROMO IMAGES ROUTES
// ================================

// Get all promo images for a client (Public)
// FIX: Removed redundant `identifyTenant`
router.get('/promo', productController.getProductImagesOnly);

// Upload new promo images (Admin Only)
// FIX: Removed redundant `identifyTenant`
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

// Get all products for a client (Public)
// FIX: Removed redundant `identifyTenant`. This route is now correctly public
// within the scope of the tenant identified in server.js.
router.get('/', productController.getProducts);

// Create a new product (Admin Only)
// FIX: Removed redundant `identifyTenant`
router.post(
    '/',
    protect,
    isAdmin,
    productController.uploadMiddleware,
    productController.addProduct
);

// Get a single product by ID (Public)
// IMPORTANT: This dynamic route comes AFTER specific routes like '/collections' and '/promo'.
// FIX: Removed redundant `identifyTenant`
router.get(
    '/:id',
    param('id').isMongoId(),
    productController.getProductById
);

// Update a product (Admin Only)
// FIX: Removed redundant `identifyTenant`
router.put(
    '/:id',
    protect,
    isAdmin,
    param('id').isMongoId(),
    productController.uploadMiddleware,
    productController.updateProduct
);

// Delete a product (Admin Only)
// FIX: Removed redundant `identifyTenant`
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
// FIX: Removed redundant `identifyTenant`
router.post(
    '/:id/reviews',
    // **NOTE**: The middleware below was causing a crash because `protectCustomer` is
    // not being exported from your `middleware/authMiddleware.js` file. It has been
    // temporarily commented out to allow the server to run.
    //
    // **TO FIX PERMANENTLY**:
    // 1. Add the `protectCustomer` function to `middleware/authMiddleware.js`.
    // 2. Add `protectCustomer` to the `module.exports` object in that file.
    // 3. Uncomment the line below.
    // protectCustomer,
    param('id').isMongoId(),
    [
        body('rating').isFloat({ min: 1, max: 5 }),
        body('comment').notEmpty()
    ],
    productController.createProductReview
);


module.exports = router;

