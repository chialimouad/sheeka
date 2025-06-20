const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const fs = require('fs');
const path = require('path');

// =========================
// 📸 Promo Image Routes — MUST come BEFORE /:id routes
// =========================

// Upload promotional images
router.post('/promo', productController.upload.array('images', 5), productController.uploadPromoImages);

// Get all promo image URLs
router.get('/promo', productController.getProductImagesOnly);

// ✅ DELETE promo image — fixed path
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

// =========================
// 🛍 Product Routes
// =========================

// Add a new product
router.post('/', productController.upload.array('images', 5), productController.addProduct);

// Get all products
router.get('/', productController.getProducts);

// Update a product
router.put('/:id', productController.updateProduct);

// ❌ This route was catching "/promo" — now it's safely below
router.delete('/promo', async (req, res) => {
  try {
    const imageUrl = req.body.url;
    console.log('Received image URL:', imageUrl);

    const fileName = imageUrl.split('/uploads/')[1];
    if (!fileName) return res.status(400).json({ message: 'Invalid image URL' });

    const filePath = path.join(__dirname, '../uploads', fileName);
    console.log('Resolved file path:', filePath);

    const Product = require('../models/Product'); // or wherever you store promo images

    // 1. Delete from disk
    fs.unlink(filePath, async (err) => {
      if (err) {
        console.error('Failed to delete from disk:', err);
        return res.status(500).json({ message: 'Failed to delete image from disk' });
      }

      // 2. Delete from database (assuming promoImages is a field storing image URLs)
      const dbResult = await Product.updateMany(
        { promoImages: imageUrl },
        { $pull: { promoImages: imageUrl } }
      );

      console.log('Removed from DB:', dbResult);

      return res.json({ message: 'Image deleted from disk and DB' });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
