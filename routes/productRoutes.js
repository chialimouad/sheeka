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
    const imageUrl = req.body.url;
    console.log('imageUrl from client:', imageUrl);

    const fileName = imageUrl.split('/uploads/')[1];
    if (!fileName) return res.status(400).json({ message: 'Invalid image URL' });

    const path = require('path');
    const filePath = path.join(__dirname, 'uploads', fileName);
    console.log('Resolved file path:', filePath);

    const fs = require('fs');
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Delete failed:', err);
        return res.status(500).json({ message: 'Failed to delete image' });
      }
      return res.json({ message: 'Image deleted' });
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

  
module.exports = router;
