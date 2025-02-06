const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../controllers/productController').upload;

// Protect all routes with JWT and restrict to admin
router.use(protect, admin);

router.post('/products', upload.single('image'), productController.addProduct);
router.get('/products', productController.getProducts);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

module.exports = router;