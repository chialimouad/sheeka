const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

// Initialize upload middleware
const upload = multer({ storage });

// Export upload middleware
exports.upload = upload;

// Add Product
exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, quantity } = req.body;
    const image = req.file.path;

    const product = new Product({ name, description, price, quantity, image });
    await product.save();

    res.status(201).json({ message: 'Product added successfully', product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get All Products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, quantity } = req.body;
    const image = req.file ? req.file.path : req.body.image;

    const product = await Product.findByIdAndUpdate(
      id,
      { name, description, price, quantity, image },
      { new: true }
    );

    res.status(200).json({ message: 'Product updated successfully', product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndDelete(id);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};