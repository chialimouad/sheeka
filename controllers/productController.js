// controllers/productController.js
const Product = require('../models/Product'); // Assuming you have a Product model
const PromoImage = require('../models/imagespromo'); // Import the new PromoImage model
const multer = require('multer'); // Middleware for handling file uploads
const path = require('path'); // Node.js module for path manipulation
const fs = require('fs'); // Node.js file system module

// =========================
// Multer Storage Configuration for Promo Images
// =========================
const promoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Define the destination folder for uploaded promo images
    const uploadPath = path.join(__dirname, '..', 'uploads', 'promo');
    // Ensure the directory exists. If not, create it recursively.
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Define the filename for the uploaded image.
    // It combines the current timestamp with the original file extension
    // to create a unique name.
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Multer filter to accept only image files for promo uploads
const promoFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Accept the file if it's an image
  } else {
    cb(new Error('Only image files are allowed for promo uploads!'), false); // Reject otherwise
  }
};

// Multer upload instance for promo images
exports.uploadPromo = multer({ storage: promoStorage, fileFilter: promoFileFilter });

// =========================
// Multer Storage Configuration for Product Images (similar to promo but in 'uploads' root)
// =========================
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Define the destination folder for uploaded product images
    const uploadPath = path.join(__dirname, '..', 'uploads');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Multer filter for product images
const productFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for product uploads!'), false);
  }
};

// Multer upload instance for product images
exports.upload = multer({ storage: productStorage, fileFilter: productFileFilter });

// =========================
// Promo Image Controllers
// =========================

/**
 * @desc Uploads promo images and saves their relative paths to the database.
 * @route POST /products/promo
 * @access Public (or specify appropriate authentication/authorization)
 */
exports.uploadPromoImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files provided for promo.' });
    }

    // Map uploaded files to their relative URLs
    // These paths should match how your Express static middleware serves them
    const imageUrls = req.files.map(file => `/uploads/promo/${file.filename}`);

    // Create or update a PromoImage document.
    // For simplicity, we'll assume one document stores all promo images.
    // You might adjust this logic if you need multiple promo sets.
    let promoDoc = await PromoImage.findOne();
    if (promoDoc) {
      // If a document exists, add new images to its array
      promoDoc.images = [...promoDoc.images, ...imageUrls];
      await promoDoc.save();
    } else {
      // If no document exists, create a new one
      promoDoc = await PromoImage.create({ images: imageUrls });
    }

    res.status(201).json({
      message: 'Promo images uploaded successfully and paths saved!',
      imageUrls: imageUrls
    });
  } catch (error) {
    console.error('Error uploading promo images:', error);
    res.status(500).json({ message: 'Failed to upload promo images', error: error.message });
  }
};

/**
 * @desc Get all promo image URLs.
 * @route GET /products/promo
 * @access Public
 */
exports.getProductImagesOnly = async (req, res) => {
  try {
    // Find the single document containing promo image paths
    const promoDoc = await PromoImage.findOne({});
    if (!promoDoc || promoDoc.images.length === 0) {
      // If no document or no images, return an empty array
      return res.status(200).json([]);
    }
    // Return only the array of image paths
    res.status(200).json(promoDoc.images);
  } catch (error) {
    console.error('Error fetching promo images:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Deletes a specific promo image from disk and database.
 * @route DELETE /products/promo?url=<imageUrl>
 * @access Public (add authentication/authorization as needed)
 */
exports.deletePromoImage = async (req, res) => {
  try {
    const imageUrl = req.query.url; // This should be the full relative path, e.g., /uploads/promo/123-image.png
    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    // Construct the absolute path to the file on the server's disk
    // Ensure the path starts with /uploads/promo/
    if (!imageUrl.startsWith('/uploads/promo/')) {
        return res.status(400).json({ message: 'Invalid image URL format. Must start with /uploads/promo/' });
    }
    const filePath = path.join(__dirname, '..', imageUrl);

    console.log('🧩 Trying to delete:', filePath);

    // Check if the file exists on disk
    if (!fs.existsSync(filePath)) {
      console.error('🚫 File not found:', filePath);
      // Even if file not found on disk, try to remove from DB for consistency
      await PromoImage.updateMany({}, { $pull: { images: imageUrl } });
      await PromoImage.deleteMany({ images: { $size: 0 } });
      return res.status(404).json({ message: 'File does not exist on disk but removed from DB if present.' });
    }

    // Delete file from disk
    fs.unlink(filePath, async (err) => {
      if (err) {
        console.error('❌ File deletion error:', err);
        return res.status(500).json({ message: 'Failed to delete image from disk' });
      }

      // Remove the image URL from the database
      const dbResult = await PromoImage.updateMany({}, { $pull: { images: imageUrl } });

      // Clean up any empty promo documents if all images are removed
      await PromoImage.deleteMany({ images: { $size: 0 } });

      console.log('✅ File and DB entry deleted');
      res.json({ message: '✅ Image deleted', dbResult });
    });
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// =========================
// Product Controllers (Placeholders)
// =========================

/**
 * @desc Add a new product.
 * @route POST /products
 * @access Private
 */
exports.addProduct = async (req, res) => {
  try {
    // Extract product details from req.body and image paths from req.files
    const { name, description, price, category } = req.body;
    const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    const newProduct = new Product({
      name,
      description,
      price,
      category,
      images: imageUrls, // Store relative paths of product images
    });

    const savedProduct = await newProduct.save();
    res.status(201).json({ message: 'Product added successfully', product: savedProduct });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Failed to add product', error: error.message });
  }
};

/**
 * @desc Get all products.
 * @route GET /products
 * @access Public
 */
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

/**
 * @desc Get product by ID.
 * @route GET /products/:id
 * @access Public
 */
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
};

/**
 * @desc Update a product.
 * @route PUT /products/:id
 * @access Private
 */
exports.updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

/**
 * @desc Delete a product.
 * @route DELETE /products/:id
 * @access Private
 */
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
};
