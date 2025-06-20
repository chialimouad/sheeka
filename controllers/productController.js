const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');

const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Node.js file system module for deleting old files

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create 'uploads' directory if it doesn't exist
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir); // Save to uploads/ directory
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB file size limit (adjust as needed)
  }
});


// --- PromoImage Handlers ---
exports.getProductImagesOnly = async (req, res) => {
  try {
    const products = await PromoImage.find({}, 'images'); // Get only the `images` field

    // Flatten the image arrays and build full URLs
    const allImages = products.flatMap(product =>
      product.images.map(img => `https://sheeka.onrender.com${img}`)
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
    // Handle the images
    const images = req.files.map(file => `/uploads/${file.filename}`); // Store correct file path

    const newPromoImage = new PromoImage({
      images,
    });

    // Save the promo image record to the database
    await newPromoImage.save();

    // Return the newly created promo image record
    res.status(201).json(newPromoImage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// New: Delete Promo Image by ID
exports.deletePromoImage = async (req, res) => {
  try {
    const promoImageId = req.params.id; // Assuming the ID is passed in the URL
    const promoImage = await PromoImage.findById(promoImageId);

    if (!promoImage) {
      return res.status(404).json({ message: 'Promo image not found in database.' });
    }

    // Delete associated files from disk
    promoImage.images.forEach(imagePath => {
      const filePath = path.join(__dirname, '..', imagePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      } else {
        console.warn(`File not found, could not delete: ${filePath}`);
      }
    });

    await PromoImage.findByIdAndDelete(promoImageId); // Delete database record

    res.status(200).json({ message: 'Promo image deleted successfully.' });
  } catch (error) {
    console.error('❌ Error deleting promo image:', error);
    res.status(500).json({ message: 'Error deleting promo image', error: error.message });
  }
};


// --- Product CRUD Handlers ---

// ✅ Add Product (POST /products) - Now handles multiple file types for images/videos
exports.addProduct = async (req, res) => {
  try {
    const { name, description, quantity, price, variants } = req.body;

    // Validate required fields
    if (!name || !description || !quantity || !price) {
      return res.status(400).json({ error: 'All fields (name, description, quantity, price) are required.' });
    }

    // Parse variants if provided
    let parsedVariants = [];
    if (variants) {
      try {
        parsedVariants = JSON.parse(variants);
        if (!Array.isArray(parsedVariants)) {
          return res.status(400).json({ error: 'Variants should be a JSON array string.' });
        }
      } catch (error) {
        return res.status(400).json({ error: 'Invalid variants format. Must be a valid JSON array string.' });
      }
    }

    // Handle uploaded files (images and videos)
    const images = [];
    const videos = [];

    // req.files will be an object with keys for each field name from `upload.fields`
    if (req.files) {
      if (req.files['images']) {
        req.files['images'].forEach(file => {
          images.push(`/uploads/${file.filename}`);
        });
      }
      if (req.files['videos']) {
        req.files['videos'].forEach(file => {
          videos.push(`/uploads/${file.filename}`);
        });
      }
    }

    // Create a new product object
    const newProduct = new Product({
      name,
      description,
      quantity,
      price: parseFloat(price), // Ensure price is parsed as a number
      images,
      videos, // Store video paths
      variants: parsedVariants,
    });

    // Save the product to the database
    await newProduct.save();

    // Return the newly created product
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
};


// ✅ Get All Products (GET /products) - Now includes videos
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }); // Sort by newest first
    const updatedProducts = products.map(product => ({
      ...product._doc,
      images: product.images ? product.images.map(img => `https://sheeka.onrender.com${img}`) : [], // Full Image URL for Flutter
      videos: product.videos ? product.videos.map(vid => `https://sheeka.onrender.com${vid}`) : [], // Full Video URL
    }));

    res.json(updatedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
};

// ✅ Update Product (PUT /products/:id) - Now handles all parameters including files
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    let product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { name, description, quantity, price, variants } = req.body;

    // Update basic fields if provided
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (quantity !== undefined) product.quantity = parseInt(quantity); // Ensure quantity is parsed as integer
    if (price !== undefined) product.price = parseFloat(price);     // Ensure price is parsed as float

    // Handle variants update
    if (variants !== undefined) {
      try {
        product.variants = JSON.parse(variants);
        if (!Array.isArray(product.variants)) {
          return res.status(400).json({ error: 'Variants should be a JSON array string.' });
        }
      } catch (error) {
        return res.status(400).json({ error: 'Invalid variants format for update. Must be a valid JSON array string.' });
      }
    }

    // Handle file uploads (images and videos)
    // If new files are uploaded, they will replace existing ones (for simplicity).
    // For more complex behavior (e.g., adding to existing, deleting specific files),
    // the client would need to send explicit instructions.
    if (req.files) {
      if (req.files['images'] && req.files['images'].length > 0) {
        // Delete old image files from disk if they exist (optional, but good practice)
        product.images.forEach(oldImagePath => {
          const filePath = path.join(__dirname, '..', oldImagePath); // Adjust path as per your server structure
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted old image file: ${filePath}`);
          }
        });
        product.images = req.files['images'].map(file => `/uploads/${file.filename}`);
      }
      if (req.files['videos'] && req.files['videos'].length > 0) {
        // Delete old video files from disk if they exist
        product.videos.forEach(oldVideoPath => {
          const filePath = path.join(__dirname, '..', oldVideoPath); // Adjust path as per your server structure
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted old video file: ${filePath}`);
          }
        });
        product.videos = req.files['videos'].map(file => `/uploads/${file.filename}`);
      }
    }

    // Save the updated product
    await product.save();

    // Return the updated product with absolute URLs
    const updatedProductResponse = {
      ...product._doc,
      images: product.images ? product.images.map(img => `https://sheeka.onrender.com${img}`) : [],
      videos: product.videos ? product.videos.map(vid => `https://sheeka.onrender.com${vid}`) : [],
    };

    res.status(200).json({ message: 'Product updated successfully', product: updatedProductResponse });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
};


// ✅ Get Product by ID (GET /products/:id) - Now includes videos
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      ...product._doc,
      images: product.images ? product.images.map(img => `https://sheeka.onrender.com${img}`) : [], // Full Image URL for Flutter
      videos: product.videos ? product.videos.map(vid => `https://sheeka.onrender.com${vid}`) : [], // Full Video URL
    });
  } catch (error) {
    console.error('Error fetching single product:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ Delete Product (DELETE /products/:id) - Now also deletes associated files
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Delete associated image files from disk
    product.images.forEach(imagePath => {
      const filePath = path.join(__dirname, '..', imagePath); // Adjust path as per your server structure
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted product image file: ${filePath}`);
      }
    });

    // Delete associated video files from disk
    product.videos.forEach(videoPath => {
      const filePath = path.join(__dirname, '..', videoPath); // Adjust path as per your server structure
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted product video file: ${filePath}`);
      }
    });

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: error.message });
  }
};

// Export Multer upload middleware specifically for product routes
// Use `.fields()` to handle multiple file inputs with specific names ('images', 'videos')
exports.productUploadMiddleware = upload.fields([
  { name: 'images', maxCount: 10 }, // Up to 10 images
  { name: 'videos', maxCount: 5 }   // Up to 5 videos
]);

// Also export the 'upload' instance itself for use with .array() or .single() in routes,
// particularly for the /promo endpoint.
exports.upload = upload; // <--- This line is critical for productController.upload.array to work
