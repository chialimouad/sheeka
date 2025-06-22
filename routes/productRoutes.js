const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

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
router.get('/:id', productController.getProductById); // Get product by ID
router.put('/:id', productController.updateProduct); // Update product (only text fields, no image)
router.delete('/:id', productController.deleteProduct); // Delete product

module.exports = router;
