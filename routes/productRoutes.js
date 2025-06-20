const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// =========================
// 🛍 Product Routes
// =========================

// Add a new product with images and/or videos
// Uses productUploadMiddleware to handle multipart/form-data with 'images' and 'videos' fields
router.post('/', productController.productUploadMiddleware, productController.addProduct);

// Get all products
router.get('/', productController.getProducts);

// Update an existing product with all modifiable parameters including new images/videos
// Uses productUploadMiddleware to handle multipart/form-data with 'images' and 'videos' fields
router.put('/:id', productController.productUploadMiddleware, productController.updateProduct);

// Delete a product
router.delete('/:id', productController.deleteProduct);

// Get a single product by ID
router.get('/:id', productController.getProductById);

// =========================
// 📸 Promo Image Routes
// =========================

// Upload promotional images (separate from product listing)
// Uses the general upload middleware which accepts images/videos for promo
router.post('/promo', productController.upload.array('images', 5), productController.uploadPromoImages);

// Get all promotional images
router.get('/promo', productController.getProductImagesOnly);

// Delete a promotional image by ID (new route and controller logic)
router.delete('/promo/:id', productController.deletePromoImage);

module.exports = router;
