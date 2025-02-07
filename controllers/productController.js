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

exports.addProduct = async (req, res) => {
  try {
    const { name, description, quantity, price } = req.body;
    const images = req.files.map(file => `/uploads/${file.filename}`);
    const newProduct = new Product({ name, description, quantity, price, images });
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports.upload = upload;