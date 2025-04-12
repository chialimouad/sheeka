const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.post('/', productController.upload.array('images', 5), productController.addProduct);
router.get('/', productController.getProducts);
router.put('/:id', productController.updateProduct); // ✅ Edit Product
router.delete('/:id', productController.deleteProduct); // ✅ Delete Product
router.post('/promo',productController.upload.array('images',5), productController.uploadPromoImages);

module.exports = router;
