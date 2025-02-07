const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.post('/', productController.upload.array('images', 5), async (req, res) => {
    try {
      const imagePaths = req.files.map(file => `/uploads/${file.filename}`);
  
      const newProduct = new Product({
        name: req.body.name,
        description: req.body.description,
        quantity: req.body.quantity,
        price: req.body.price,
        images: imagePaths,
      });
  
      await newProduct.save();
      res.status(201).json({ message: 'Product added', product: newProduct });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error saving product' });
    }
  });
  router.get('/', productController.getProducts);
router.get('/products', async (req, res) => {
    try {
      const products = await Product.find();
      const updatedProducts = products.map(product => ({
        ...product._doc,
        images: product.images.map(img => `https://sheeka.onrender.com${img}`)
      }));
  
      res.json(updatedProducts);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching products' });
    }
  });
  
module.exports = router;