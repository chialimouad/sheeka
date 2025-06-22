const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// ================================
// 📦 PRODUCT ROUTES
// ================================

// ✅ Get all products
router.get('/', productController.getProducts);

// ✅ Add new product (images upload to Cloudinary)
router.post(
  '/',
  productController.upload.array('images', 5), // max 5 images
  productController.addProduct
);

// ✅ Get product by ID
router.get('/:id', productController.getProductById);

// ✅ Update product (only text fields, no image)
router.put('/:id', productController.updateProduct);

// ✅ Delete product
router.delete('/:id', productController.deleteProduct);

// ================================
// 🎯 PROMO IMAGES ROUTES
// ================================

// ✅ Get promo images
router.get('/promo', productController.getProductImagesOnly);

// ✅ Upload promo images
router.post(
  '/promo',
  productController.uploadPromo.array('images', 5),
  productController.uploadPromoImages
);

// ✅ Delete a specific promo image (by URL param)
router.delete('/promo', productController.deletePromoImage);

// ================================
// 📁 COLLECTION ROUTES
// ================================

router.get('/collections', productController.getCollections);
router.post('/collections', productController.addCollection);
router.put('/collections/:id', productController.updateCollection);
router.delete('/collections/:id', productController.deleteCollection);

module.exports = router;
