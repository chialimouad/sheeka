const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
// NOTE: You would typically have an authentication middleware to protect routes.
// const { protect } = require('../middleware/authMiddleware');

// ================================
// 🎯 PROMO IMAGES ROUTES
// ================================
router.route('/promo')
    .get(productController.getProductImagesOnly)
    .post(productController.uploadPromo.array('images', 5), productController.uploadPromoImages)
    .delete(productController.deletePromoImage);

// ================================
// 🛒 COLLECTION ROUTES
// ================================
router.route('/collections')
    .get(productController.getCollections)
    .post(productController.addCollection);

router.route('/collections/:id')
    .get(productController.getCollectionById)
    .put(productController.updateCollection)
    .delete(productController.deleteCollection);

// ================================
// ⭐ REVIEW ROUTES
// These must be defined BEFORE the general '/:id' route to avoid conflicts.
// ================================
// The 'protect' middleware should be added here to ensure only authenticated users can post reviews.
router.route('/:id/reviews')
    .get(productController.getProductReviews)
    .post(/* protect, */ productController.createProductReview);

// ================================
// 📦 PRODUCT ROUTES
// ================================
router.route('/')
    .get(productController.getProducts)
    .post(
        productController.upload.array('images', 5), // max 5 images
        productController.addProduct
    );

// This generic route with an ID must be last to avoid conflicts with other specific routes.
router.route('/:id')
    .get(productController.getProductById)
    .put(productController.updateProduct) // This controller handler includes the multer middleware
    .delete(productController.deleteProduct);


module.exports = router;
