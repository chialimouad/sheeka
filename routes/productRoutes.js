// ===================== BACKEND: routes/products.js =====================

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const productController = require('../controllers/productController');
const Product = require('../models/Product'); // Assuming promo images are stored in Product schema

// =========================
// 📸 Promo Image Routes
// =========================

// Upload promotional images
router.post('/promo', productController.upload.array('images', 5), productController.uploadPromoImages);

// Get promo images
router.get('/promo', productController.getProductImagesOnly);

// Delete promo image (from disk + DB)
router.delete('/promo', async (req, res) => {
  try {
    const imageUrl = req.body.url;
    console.log('Received image URL:', imageUrl);

    const fileName = imageUrl.split('/uploads/')[1];
    if (!fileName) return res.status(400).json({ message: 'Invalid image URL' });

    const filePath = path.join(__dirname, '../uploads', fileName);

    fs.unlink(filePath, async (err) => {
      if (err) {
        console.error('File deletion failed:', err);
        return res.status(500).json({ message: 'Failed to delete image from disk' });
      }

      // Delete from DB (all matching products)
      const dbResult = await Product.updateMany(
        { promoImages: imageUrl },
        { $pull: { promoImages: imageUrl } }
      );

      console.log('DB update result:', dbResult);
      return res.json({ message: 'Image deleted' });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =========================
// 🏢 Product Routes
// =========================

router.post('/', productController.upload.array('images', 5), productController.addProduct);
router.get('/', productController.getProducts);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
