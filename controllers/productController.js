const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');

// ✅ Configure Multer for Local Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save to uploads/ directory
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// ✅ Add Product (POST /products)
exports.addProduct = async (req, res) => {
  try {
    const { name, description, quantity, price } = req.body;
    if (!name || !description || !quantity || !price) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const images = req.files.map(file => `/uploads/${file.filename}`); // ✅ Store correct file path

    const newProduct = new Product({ name, description, quantity, price, images });
    await newProduct.save();

    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Get All Products (GET /products)
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }); // ✅ Sort by newest first
    const updatedProducts = products.map(product => ({
      ...product._doc,
      images: product.images.map(img => `https://sheeka.onrender.com${img}`), // ✅ Full Image URL for Flutter
    }));

    res.json(updatedProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
};

// ✅ Update Product (PUT /products/:id)
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, quantity, price } = req.body;
    const updatedFields = { name, description, quantity, price };

    const product = await Product.findByIdAndUpdate(req.params.id, updatedFields, { new: true });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully', product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Delete Product (DELETE /products/:id)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports.upload = upload;
