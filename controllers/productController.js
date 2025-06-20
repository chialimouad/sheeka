// controllers/productController.js
const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo'); // Assuming this is for separate promo images model

const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Node.js file system module for deleting old files

// --- Multer Configuration for Local Disk Storage ---
const storage = multer.diskStorage({
    // Destination for storing uploaded files
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        // Ensure the upload directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); // Save to uploads/ directory
    },
    // Define the filename for uploaded files
    filename: (req, file, cb) => {
        // Use current timestamp and original filename to create a unique name
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// Initialize Multer upload instance for local disk storage
// This instance will be used for both product media and promo images.
const upload = multer({
    storage: storage,
    // File filter to accept only image and video files for general uploads
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true); // Accept file
        } else {
            cb(new Error('Only image and video files are allowed!'), false); // Reject file
        }
    },
    // File size limit (100 MB)
    limits: {
        fileSize: 100 * 1024 * 1024 
    }
});


// --- PromoImage Handlers ---

/**
 * @desc Get all promotional images (URLs only)
 * @route GET /api/products/promo
 * @access Public
 */
exports.getProductImagesOnly = async (req, res) => {
    try {
        // Find all promo image documents and select only the 'images' field
        const promoImages = await PromoImage.find({}, 'images');

        // Flatten the image arrays and build full URLs
        const allImages = promoImages.flatMap(promo =>
            promo.images.map(img => {
                // IMPORTANT: In a production environment, use an environment variable for the base URL
                // e.g., `${process.env.BASE_URL}${img}`
                return `https://sheeka.onrender.com${img}`;
            })
        );

        res.json(allImages);
    } catch (error) {
        console.error('❌ Error fetching promo images:', error);
        res.status(500).json({ message: 'Error fetching promo images', error: error.message });
    }
};

/**
 * @desc Upload new promotional images
 * @route POST /api/products/promo
 * @access Private (admin)
 * @middleware upload.array('images', 5)
 */
exports.uploadPromoImages = async (req, res) => {
    try {
        // Check if any files were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        // Map uploaded files to their relative paths
        const images = req.files.map(file => `/uploads/${file.filename}`);

        // Create a new PromoImage document
        const newPromoImage = new PromoImage({ // Changed variable name from newProduct to newPromoImage for clarity
            images,
        });

        // Save the promo image record to the database
        await newPromoImage.save();

        // Return the newly created promo image record
        res.status(201).json(newPromoImage);
    } catch (error) {
        console.error('❌ Error uploading promo images:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * @desc Delete a promotional image by ID and its associated files from local disk
 * @route DELETE /api/products/promo/:id
 * @access Private (admin)
 */
exports.deletePromoImage = async (req, res) => {
    try {
        const promoImageId = req.params.id; // Get the promo image ID from URL parameters
        const promoImage = await PromoImage.findById(promoImageId);

        // Check if the promo image exists
        if (!promoImage) {
            return res.status(404).json({ message: 'Promo image not found in database.' });
        }

        // Delete associated files from disk
        promoImage.images.forEach(imagePath => {
            // Construct the absolute file path, assuming 'uploads/' is relative to the project root
            const filePath = path.join(__dirname, '..', imagePath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath); // Synchronously delete the file
                console.log(`Deleted file: ${filePath}`);
            } else {
                console.warn(`File not found, could not delete: ${filePath}`);
            }
        });

        // Delete the promo image record from the database
        await PromoImage.findByIdAndDelete(promoImageId);

        res.status(200).json({ message: 'Promo image deleted successfully.' });
    } catch (error) {
        console.error('❌ Error deleting promo image:', error);
        res.status(500).json({ message: 'Error deleting promo image', error: error.message });
    }
};


// --- Product CRUD Handlers ---

/**
 * @desc Add a new product with multiple images and videos
 * @route POST /api/products
 * @access Private (admin)
 * @middleware productUploadMiddleware (multer.fields for 'images' and 'videos')
 */
exports.addProduct = async (req, res) => {
    try {
        const { name, description, quantity, price, variants } = req.body;

        // Validate required fields
        if (!name || !description || !quantity || !price) {
            return res.status(400).json({ error: 'All fields (name, description, quantity, price) are required.' });
        }

        // Parse variants if provided (expects a JSON string)
        let parsedVariants = [];
        if (variants) {
            try {
                parsedVariants = JSON.parse(variants);
                // Ensure parsed variants is an array
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

        // ✅ FIX: req.files is an object when using upload.fields, not an array.
        // Access files by their field names ('images', 'videos').
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
            quantity: parseInt(quantity), // Ensure quantity is parsed as an integer
            price: parseFloat(price),     // Ensure price is parsed as a float
            images,
            videos, // Store video paths
            variants: parsedVariants,
        });

        // Save the product to the database
        await newProduct.save();

        // Return the newly created product
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('❌ Error creating product:', error);
        res.status(500).json({ error: error.message });
    }
};


/**
 * @desc Get all products
 * @route GET /api/products
 * @access Public
 */
exports.getProducts = async (req, res) => {
    try {
        // Find all products and sort them by creation date (newest first)
        const products = await Product.find().sort({ createdAt: -1 });

        // Map through products to construct full URLs for images and videos
        const updatedProducts = products.map(product => ({
            ...product._doc, // Spread the original document fields
            // Construct full URLs for images, handling cases where images array might be empty
            images: product.images ? product.images.map(img => {
                // IMPORTANT: In a production environment, use an environment variable for the base URL
                return `https://sheeka.onrender.com${img}`;
            }) : [],
            // Construct full URLs for videos, handling cases where videos array might be empty
            videos: product.videos ? product.videos.map(vid => {
                // IMPORTANT: In a production environment, use an environment variable for the base URL
                return `https://sheeka.onrender.com${vid}`;
            }) : [],
        }));

        res.json(updatedProducts);
    } catch (error) {
        console.error('❌ Error fetching products:', error);
        res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
};

/**
 * @desc Update an existing product, including its details and associated files
 * @route PUT /api/products/:id
 * @access Private (admin)
 * @middleware productUploadMiddleware (multer.fields for 'images' and 'videos')
 */
exports.updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        let product = await Product.findById(productId);

        // Check if the product exists
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const { name, description, quantity, price, variants } = req.body;

        // Update basic fields if they are provided in the request body
        if (name !== undefined) product.name = name;
        if (description !== undefined) product.description = description;
        if (quantity !== undefined) product.quantity = parseInt(quantity); // Ensure quantity is parsed as integer
        if (price !== undefined) product.price = parseFloat(price);     // Ensure price is parsed as float

        // Handle variants update (expects a JSON string)
        if (variants !== undefined) {
            try {
                product.variants = JSON.parse(variants);
                // Ensure parsed variants is an array
                if (!Array.isArray(product.variants)) {
                    return res.status(400).json({ error: 'Variants should be a JSON array string.' });
                }
            } catch (error) {
                return res.status(400).json({ error: 'Invalid variants format for update. Must be a valid JSON array string.' });
            }
        }

        // Handle file uploads (images and videos)
        // If new files are uploaded, they will replace existing ones.
        if (req.files) {
            if (req.files['images'] && req.files['images'].length > 0) {
                // Delete old image files from disk if they exist
                product.images.forEach(oldImagePath => {
                    const filePath = path.join(__dirname, '..', oldImagePath); // Adjust path as per your server structure
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted old image file: ${filePath}`);
                    } else {
                        console.warn(`File not found for deletion: ${filePath}`);
                    }
                });
                // Assign new image paths
                product.images = req.files['images'].map(file => `/uploads/${file.filename}`);
            }
            if (req.files['videos'] && req.files['videos'].length > 0) {
                // Delete old video files from disk if they exist
                product.videos.forEach(oldVideoPath => {
                    const filePath = path.join(__dirname, '..', oldVideoPath); // Adjust path as per your server structure
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted old video file: ${filePath}`);
                    } else {
                        console.warn(`File not found for deletion: ${filePath}`);
                    }
                });
                // Assign new video paths
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
        console.error('❌ Error updating product:', error);
        res.status(500).json({ error: error.message });
    }
};


/**
 * @desc Get a single product by ID
 * @route GET /api/products/:id
 * @access Public
 */
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
        console.error('❌ Error fetching single product:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * @desc Delete a product by ID and its associated files
 * @route DELETE /api/products/:id
 * @access Private (admin)
 */
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
            } else {
                console.warn(`Product image file not found for deletion: ${filePath}`);
            }
        });

        // Delete associated video files from disk
        product.videos.forEach(videoPath => {
            const filePath = path.join(__dirname, '..', videoPath); // Adjust path as per your server structure
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted product video file: ${filePath}`);
            } else {
                console.warn(`Product video file not found for deletion: ${filePath}`);
            }
        });

        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting product:', error);
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
exports.upload = upload;
