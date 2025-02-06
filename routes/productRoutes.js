const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { upload } = productController; // Import upload middleware

// Add Product
router.post('/products', upload.single('image'), productController.addProduct);

// Get All Products
router.get('/products', productController.getProducts);

// Update Product
router.put('/products/:id', upload.single('image'), productController.updateProduct);

// Delete Product
router.delete('/products/:id', productController.deleteProduct);

module.exports = router;