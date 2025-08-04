/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 *
 * FIX:
 * - Added the `protect` middleware to the `GET /` route. This endpoint should
 * not be public; it requires an authenticated user. This change ensures
 * the user is verified before attempting to fetch the product list,
 * resolving the `400 Bad Request` error.
 * - Removed the redundant `identifyTenant` middleware from all route definitions.
 * This middleware is already applied globally to the `/products` route group
 * in `server.js`.
 * - Temporarily commented out the `protectCustomer` middleware in the review route.
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
router.get('/collections', protect, isAdmin, productController.getCollections);

// Create a new collection (Admin Only)
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
// FIX: Added `protect` middleware. The request must come from a logged-in user.
router.get('/', protect, productController.getProducts);

// Create a new product (Admin Only)
router.post(
    '/',
    protect,
    isAdmin,
    productController.uploadMiddleware,
    productController.addProduct
);

// Get a single product by ID (Public)
// IMPORTANT: This dynamic route comes AFTER specific routes like '/collections' and '/promo'.
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
