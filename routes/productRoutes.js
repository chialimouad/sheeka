const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
// NOTE: You would typically have an authentication middleware to protect routes.
// const { protect } = require('../middleware/authMiddleware');

// ================================
// 🎯 PROMO IMAGES ROUTES
// Placed first to ensure specific static routes are matched before dynamic :id routes
// ================================
router.get('/promo', productController.getProductImagesOnly);
router.post('/promo', productController.uploadPromo.array('images', 5), productController.uploadPromoImages);
router.delete('/promo', productController.deletePromoImage);

// ================================
// 🛒 COLLECTION ROUTES
// Added dedicated routes for collections
// ================================
router.get('/collections', productController.getCollections);
router.post('/collections', productController.addCollection);
router.get('/collections/:id', productController.getCollectionById); // Get collection by ID
router.put('/collections/:id', productController.updateCollection);
router.delete('/collections/:id', productController.deleteCollection);

// ================================
// 📦 PRODUCT ROUTES (General product operations)
// ================================
router.get('/', productController.getProducts); // Get all products
router.post(
  '/',
  productController.upload.array('images', 5), // max 5 images
  productController.addProduct
);

// ================================
// ⭐ REVIEW ROUTES
// These must be defined BEFORE the general '/:id' route to avoid conflicts.
// ================================
// The 'protect' middleware should be added here to ensure only authenticated users can post reviews.
router.post('/:id/reviews', /* protect, */ productController.createProductReview);
// Route for fetching all reviews for a specific product
router.get('/:id/reviews', productController.getProductReviews);


// ================================
// 📦 GENERAL PRODUCT ID ROUTE
// This is the most generic route, so it must be placed last.
// ================================
router.get('/:id', productController.getProductById); // Get product by ID
router.put('/:id', productController.updateProduct); // Update product (handles text fields and/or image uploads)
router.delete('/:id', productController.deleteProduct); // Delete product


module.exports = router;
