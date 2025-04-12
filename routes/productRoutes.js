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
// Add this route to serve promo images
router.get('/promo', productController.getProductImagesOnly);
// Node.js + Express (example)
router.delete('/products/promo', async (req, res) => {
    try {
      const imageUrl = req.body.url; // full image URL
  
      // Extract just the filename
      const fileName = imageUrl.split('/uploads/')[1];
  
      // Remove from server (adjust path as needed)
      const fs = require('fs');
      fs.unlink(`uploads/${fileName}`, (err) => {
        if (err) return res.status(500).json({ message: 'Failed to delete image' });
        return res.json({ message: 'Image deleted' });
      });
  
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
module.exports = router;
