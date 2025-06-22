const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// ✅ Collection routes
router.get('/collections', productController.getCollections);
router.post('/collections', productController.addCollection);
router.put('/collections/:id', productController.updateCollection);
router.delete('/collections/:id', productController.deleteCollection);

// ✅ Product routes
// GET all products
router.get('/', productController.getProducts);
// POST add a new product (with image upload)
router.post('/', productController.upload.array('images'), productController.addProduct);
// GET a specific product by ID
router.get('/:id', productController.getProductById);
// PUT update a product by I
router.put('/:id', productController.updateProduct);
// DELETE a product by ID
router.delete('/:id', productController.deleteProduct);


// ✅ Promo Image routes (Moved to a distinct path to avoid conflict)
// GET all promo images
router.get('/promo', productController.getProductImagesOnly);

// POST upload new promo images (multiple)
router.post(
    '/promo', // Changed to /promo
    productController.uploadPromo.array('images'),
    productController.uploadPromoImages
);

// DELETE a specific promo image by URL
router.delete('/promo', productController.deletePromoImage);

module.exports = router;
