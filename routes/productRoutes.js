const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { upload } = productController; // Import upload middleware

// Use upload.single('image') for handling image uploads
router.post('/products', upload.single('image'), productController.addProduct);

// Get all products
router.get('/products', productController.getProducts);

module.exports = router;