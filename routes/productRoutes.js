// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// =========================
// 🛍 Product Routes
// =========================

/**
 * @route POST /api/products
 * @desc Add a new product with images and/or videos
 * @access Private (admin)
 * @middleware productUploadMiddleware handles multipart/form-data for 'images' and 'videos' fields
 */
router.post('/', productController.productUploadMiddleware, productController.addProduct);

/**
 * @route GET /api/products
 * @desc Get all products
 * @access Public
 */
router.get('/', productController.getProducts);

/**
 * @route PUT /api/products/:id
 * @desc Update an existing product with all modifiable parameters including new images/videos
 * @access Private (admin)
 * @middleware productUploadMiddleware handles multipart/form-data for 'images' and 'videos' fields
 */
router.put('/:id', productController.productUploadMiddleware, productController.updateProduct);

/**
 * @route DELETE /api/products/:id
 * @desc Delete a product and its associated files
 * @access Private (admin)
 */
router.delete('/:id', productController.deleteProduct);

/**
 * @route GET /api/products/:id
 * @desc Get a single product by ID
 * @access Public
 */
router.get('/:id', productController.getProductById);

// =========================
// 📸 Promo Image Routes
// =========================

/**
 * @route POST /api/products/promo
 * @desc Upload promotional images (separate from product listing)
 * @access Private (admin)
 * @middleware productController.upload.array('images', 5) handles multiple image uploads
 */
router.post('/promo', productController.upload.array('images', 5), productController.uploadPromoImages);

/**
 * @route GET /api/products/promo
 * @desc Get all promotional images (URLs only)
 * @access Public
 */
router.get('/promo', productController.getProductImagesOnly);

/**
 * @route DELETE /api/products/promo/:id
 * @desc Delete a promotional image by ID and its associated files
 * @access Private (admin)
 */
router.delete('/promo/:id', productController.deletePromoImage);

module.exports = router;
