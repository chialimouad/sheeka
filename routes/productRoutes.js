const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Upload images and add product
router.post('/', productController.upload.array('images', 5), productController.addProduct);

// Get all products with full image URLs
router.get('/', async (req, res) => {
  try {
    const products = await productController.getProductsFromDB(); // Call a helper function
    const baseUrl = "https://sheeka.onrender.com"; // Ensure full URL
    const updatedProducts = products.map(product => ({
      ...product._doc,
      images: product.images.map(img => `${baseUrl}${img}`) // Convert to full URL
    }));
    res.json(updatedProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
});

module.exports = router;
