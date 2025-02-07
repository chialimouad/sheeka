const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, checkRole } = require('../middleware/authMiddleware');

router.post('/', protect, checkRole(['admin']), productController.upload.array('images', 5), productController.addProduct);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.put('/:id', protect, checkRole(['admin']), productController.upload.array('images', 5), productController.updateProduct);
router.delete('/:id', protect, checkRole(['admin']), productController.deleteProduct);

module.exports = router;
