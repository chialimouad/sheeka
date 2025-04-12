const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// =========================
// 🛍 Product Routes
// =========================

// Add a new product with images
router.post('/', productController.upload.array('images', 5), productController.addProduct);

// Get all products
router.get('/', productController.getProducts);

// Update an existing product
router.put('/:id', productController.updateProduct);

// Delete a product
router.delete('/:id', productController.deleteProduct);

// =========================
// 📸 Promo Image Upload Route
// =========================

// Upload promotional images (separate from product listing)
router.post('/promo', productController.upload.array('images', 5), productController.uploadPromoImages);

module.exports = router;
