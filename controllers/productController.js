const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');

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


exports.getPromoImages = async (req, res) => {
  try {
    const promoDir = path.join(__dirname, '../uploads/promo');
    const files = await fs.promises.readdir(promoDir);
    res.status(200).json({ images: files });
  } catch (error) {
    console.error('❌ Error fetching promo images:', error);
    res.status(500).json({ message: 'Failed to load promo images' });
  }
};

exports.uploadPromoImages = async (req, res) => {
  try {

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    // Handle the images
    const images = req.files.map(file => `/uploads/${file.filename}`); // ✅ Store correct file path

    const newProduct = new PromoImage({
      images,
    });

    // Save the product to the database
    await newProduct.save();

    // Return the newly created product
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};








// ✅ Add Product (POST /products)
exports.addProduct = async (req, res) => {
  try {
    const { name, description, quantity, price, variants } = req.body;

    // Validate required fields
    if (!name || !description || !quantity || !price) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate that variants are in the correct format
    let parsedVariants = [];
    if (variants) {
      try {
        parsedVariants = JSON.parse(variants);
        // Optionally validate the structure of the variants
        if (!Array.isArray(parsedVariants)) {
          return res.status(400).json({ error: 'Variants should be an array' });
        }
      } catch (error) {
        return res.status(400).json({ error: 'Invalid variants format' });
      }
    }

    // Handle the images
    const images = req.files.map(file => `/uploads/${file.filename}`); // ✅ Store correct file path

    // Create a new product object
    const newProduct = new Product({
      name,
      description,
      quantity,
      price,
      images,
      variants: parsedVariants, // Store the variants data
    });

    // Save the product to the database
    await newProduct.save();

    // Return the newly created product
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
// ✅ Get Product by ID (GET /products/:id)
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      ...product._doc,
      images: product.images.map(img => `https://sheeka.onrender.com${img}`), // ✅ Full Image URL for Flutter
    });
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
