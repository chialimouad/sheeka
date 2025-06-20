const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const fs = require('fs');
const path = require('path');

// =========================
// 🛍 Product Routes
// =========================

// ✅ Add a new product with images/videos
router.post(
  '/',
  productController.upload.array('files', 10), // Accept both images & videos
  productController.addProduct
);

// ✅ Get all products
router.get('/', productController.getProducts);

// ✅ Update an existing product
router.put('/:id', productController.updateProduct);

// ✅ Delete a product
router.delete('/:id', productController.deleteProduct);

// ✅ Get a single product by ID
router.get('/:id', productController.getProductById);


// =========================
// 📸 Promo Image Upload Routes
// =========================

// ✅ Upload promotional images (images only)
router.post(
  '/promo',
  productController.upload.array('files', 10),
  productController.uploadPromoImages
);

// ✅ Get all promo images (images only)
router.get('/promo', productController.getProductImagesOnly);

// ✅ Delete a promo image by URL
router.delete('/promo', async (req, res) => {
  try {
    const imageUrl = req.body.url;

    if (!imageUrl || !imageUrl.includes('/uploads/')) {
      return res.status(400).json({ message: 'Invalid image URL' });
    }

    const fileName = imageUrl.split('/uploads/')[1];
    const filePath = path.join(__dirname, '..', 'uploads', fileName);

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
        return res.status(500).json({ message: 'Failed to delete image' });
      }
      return res.json({ message: 'Image deleted successfully' });
    });

  } catch (error) {
    console.error('Server error deleting image:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
