const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');

// Image Upload Setup
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

exports.upload = upload;

exports.addProduct = async (req, res) => {
  try {
    const { name, description, quantity, price } = req.body;
    const baseUrl = `${req.protocol}://${req.get('host')}`; // Get full URL of server
    const images = req.files.map(file => `${baseUrl}/uploads/${file.filename}`);

    const newProduct = new Product({ name, description, quantity, price, images });
    await newProduct.save();
    
    res.status(201).json({ message: 'Product added', product: newProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get Products Helper Function
exports.getProductsFromDB = async () => {
  return await Product.find();
};

// Get All Products API
exports.getProducts = async (req, res) => {
  try {
    const products = await exports.getProductsFromDB();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
