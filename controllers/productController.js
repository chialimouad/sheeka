const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// =========================
// 📦 Multer Setup
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });
exports.upload = upload; // For product images

const uploadPromo = multer({ storage });
exports.uploadPromo = uploadPromo; // For promo images

// =========================
// 📸 Promo Image Handlers
// =========================
exports.getProductImagesOnly = async (req, res) => {
  try {
    const promos = await PromoImage.find({}, 'images');
    const allImages = promos.flatMap(p =>
      p.images.map(img => `https://sheeka.onrender.com${img}`)
    );
    res.json(allImages);
  } catch (error) {
    console.error('❌ Error fetching promo images:', error);
    res.status(500).json({ message: 'Error fetching promo images' });
  }
};

exports.uploadPromoImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const images = req.files.map(file => `/uploads/${file.filename}`);
    const newPromo = new PromoImage({ images });
    await newPromo.save();
    res.status(201).json(newPromo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// in your deletePromoImage controller
exports.deletePromoImage = async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    const relativePath = new URL(imageUrl).pathname;
    const filePath = path.join(__dirname, '..', relativePath); // <-- FIXED

    console.log('🧩 Attempting to delete:', filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File does not exist on disk' });
    }

    fs.unlink(filePath, async (err) => {
      if (err) {
        console.error('❌ File deletion failed:', err);
        return res.status(500).json({ message: 'Failed to delete image from disk' });
      }

      const dbResult = await PromoImage.updateMany({}, { $pull: { images: relativePath } });
      await PromoImage.deleteMany({ images: { $size: 0 } });

      res.json({ message: '✅ Image deleted', dbResult });
    });
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};






// =========================
// 🏢 Product Handlers
// =========================
exports.addProduct = async (req, res) => {
  try {
    const { name, description, quantity, price, variants } = req.body;

    if (!name || !description || !quantity || !price) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    let parsedVariants = [];
    if (variants) {
      try {
        parsedVariants = JSON.parse(variants);
        if (!Array.isArray(parsedVariants)) {
          return res.status(400).json({ error: 'Variants should be an array' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid variants format' });
      }
    }

    const images = req.files.map(file => `/uploads/${file.filename}`);

    const newProduct = new Product({
      name,
      description,
      quantity,
      price,
      images,
      variants: parsedVariants
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    const updated = products.map(p => ({
      ...p._doc,
      images: p.images.map(img => `https://sheeka.onrender.com${img}`)
    }));
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({
      ...product._doc,
      images: product.images.map(img => `https://sheeka.onrender.com${img}`)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { name, description, quantity, price } = req.body;
    const updatedFields = { name, description, quantity, price };

    const product = await Product.findByIdAndUpdate(req.params.id, updatedFields, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product updated successfully', product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
