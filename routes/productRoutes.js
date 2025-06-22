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

// ✅ PROMO FIRST to avoid conflict with /:id
router.get('/promo', productController.getProductImagesOnly);
router.post('/promo', productController.uploadPromo.array('images', 5), productController.uploadPromoImages);
router.delete('/promo', productController.deletePromoImage);

// ✅ Then other routes
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);


module.exports = router;
