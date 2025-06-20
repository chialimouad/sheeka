const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
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
// 📸 Promo Image Routes
// =========================

// Upload promotional images (separate from product listing)
router.post('/promo', productController.upload.array('images', 5), productController.uploadPromoImages);

// Get all promo image URLs
router.get('/promo', productController.getProductImagesOnly);

// ✅ Corrected delete promo image route
router.delete('/promo', async (req, res) => {
  try {
    const imageUrl = req.body.url;
    console.log('Received image URL:', imageUrl);

    const fileName = imageUrl.split('/uploads/')[1];
    if (!fileName) return res.status(400).json({ message: 'Invalid image URL' });

    const filePath = path.join(__dirname, '../uploads', fileName);
    console.log('Resolved file path:', filePath);

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Failed to delete:', err);
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
