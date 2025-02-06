const multer = require('multer');
const path = require('path');

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

// Add Product Controller
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