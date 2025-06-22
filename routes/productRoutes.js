// ✅ productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// ✅ Specific routes first
router.get('/collections', productController.getCollections);
router.post('/collections', productController.addCollection);
router.put('/collections/:id', productController.updateCollection);
router.delete('/collections/:id', productController.deleteCollection);

// ✅ Product routes
router.get('/', productController.getProducts);
router.post('/', productController.upload.array('images'), productController.addProduct);
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
// GET promo images
router.get('/', productController.getProductImagesOnly);

// POST upload promo images (multiple)
router.post(
  '/',
  productController.uploadPromo.array('images'),
  productController.uploadPromoImages
);

// DELETE a specific promo image by URL
router.delete('/', productController.deletePromoImage);
module.exports = router;