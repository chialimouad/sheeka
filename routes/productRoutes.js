const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// =========================
// 📸 Promo Image Routes
// =========================
router.post('/promo', productController.uploadPromo.array('images', 5), productController.uploadPromoImages);
router.get('/promo', productController.getProductImagesOnly);
router.delete('/promo', productController.deletePromoImage);

// =========================
// 🏢 Product Routes
// =========================
router.post('/', productController.upload.array('images', 5), productController.addProduct);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
   


// ✅ Define specific routes first
router.get('/collections', productController.getCollections);
router.post('/collections', productController.addCollection);
router.put('/collections/:id', productController.updateCollection);
router.delete('/collections/:id', productController.deleteCollection);

// ✅ THEN define dynamic routes last
router.get('/:id', productController.getProductById);

module.exports = router;
