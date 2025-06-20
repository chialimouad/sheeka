const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');
const multer = require('multer');
const path = require('path');

// ✅ Multer Storage + Video/Image Filter
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save files to uploads folder
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-matroska',
    'video/x-msvideo'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed.'), false);
  }
};

const upload = multer({ storage, fileFilter });
module.exports.upload = upload;

// ✅ GET: Only Promo Images
exports.getProductImagesOnly = async (req, res) => {
  try {
    const products = await PromoImage.find({}, 'images');
    const allImages = products.flatMap(product =>
      product.images.map(img => `https://sheeka.onrender.com${img}`)
    );
    res.json(allImages);
  } catch (error) {
    console.error('❌ Error fetching product images:', error);
    res.status(500).json({ message: 'Error fetching product images' });
  }
};

// ✅ POST: Upload Promo Images (images only)
exports.uploadPromoImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const images = req.files.map(file => `/uploads/${file.filename}`);

    const newPromo = new PromoImage({
      images
    });

    await newPromo.save();
    res.status(201).json(newPromo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ POST: Add Product with Images & Videos
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
      } catch (error) {
        return res.status(400).json({ error: 'Invalid variants format' });
      }
    }

    const images = [];
    const videos = [];

    req.files.forEach(file => {
      const filePath = `/uploads/${file.filename}`;
      if (file.mimetype.startsWith('video')) {
        videos.push(filePath);
      } else {
        images.push(filePath);
      }
    });

    const newProduct = new Product({
      name,
      description,
      quantity,
      price,
      images,
      videos,
      variants: parsedVariants
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ GET: All Products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    const updatedProducts = products.map(product => ({
      ...product._doc,
      images: product.images.map(img => `https://sheeka.onrender.com${img}`),
      videos: product.videos?.map(vid => `https://sheeka.onrender.com${vid}`) || []
    }));
    res.json(updatedProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
};

// ✅ GET: Product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({
      ...product._doc,
      images: product.images.map(img => `https://sheeka.onrender.com${img}`),
      videos: product.videos?.map(vid => `https://sheeka.onrender.com${vid}`) || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ PUT: Update Product
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

// ✅ DELETE: Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
