const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');

// ✅ Configure Multer for Local Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save to uploads/ directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

exports.addProduct = async (req, res) => {
  try {
    const { name, description, quantity, price } = req.body;
    const images = req.files.map(file => `/uploads/${file.filename}`); // Store file path

    const newProduct = new Product({ name, description, quantity, price, images });
    await newProduct.save();

    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Return Full Image URL When Fetching Products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    const updatedProducts = products.map(product => ({
      ...product._doc,
      images: product.images.map(img => `https://sheeka.onrender.com${img}`) // Add full URL
    }));

    res.json(updatedProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
};

module.exports.upload = upload;
