/**
 * FILE: ./routes/productRoutes.js
 * DESC: Defines API endpoints for products, collections, and reviews.
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const productController = require('../controllers/productController');
const { protect, isAdmin, protectCustomer } = require('../middleware/authMiddleware');

// ================================
// 🛒 COLLECTION ROUTES
// ================================

// FIX: This route is now PUBLIC for the storefront. Your admin panel will still work.
router.get('/collections', productController.getCollections);

// Create, Update, Delete are still PROTECTED for admins only.
router.post('/collections', protect, isAdmin, body('name').notEmpty().withMessage('Collection name is required.'), productController.addCollection);
router.put('/collections/:id', protect, isAdmin, param('id').isMongoId(), productController.updateCollection);
router.delete('/collections/:id', protect, isAdmin, param('id').isMongoId(), productController.deleteCollection);


// ================================
// 📸 PROMO IMAGES ROUTES
// ================================

router.get('/promo', productController.getProductImagesOnly);
router.post('/promo', protect, isAdmin, productController.uploadMiddleware, productController.uploadPromoImages);


// ================================
// 📦 PRODUCT ROUTES
// ================================

// FIX: This route is now PUBLIC for the storefront. Your admin panel will still work.
router.get('/', productController.getProducts);

// Create, Update, Delete are still PROTECTED for admins only.
router.post('/', protect, isAdmin, productController.uploadMiddleware, productController.addProduct);
router.get('/:id', param('id').isMongoId(), productController.getProductById);
router.put('/:id', protect, isAdmin, param('id').isMongoId(), productController.uploadMiddleware, productController.updateProduct);
router.delete('/:id', protect, isAdmin, param('id').isMongoId(), productController.deleteProduct);


// ================================
// ⭐ REVIEW ROUTES
// ================================

router.post('/:id/reviews', protectCustomer, param('id').isMongoId(), [
    body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
    body('comment').notEmpty().withMessage('Comment cannot be empty.')
], productController.createProductReview);

module.exports = router;
