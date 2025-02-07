const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.post('/', productController.upload.array('images', 5), productController.addProduct);
router.get('/', productController.getProducts);

module.exports = router;