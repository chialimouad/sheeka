// controllers/productController.js
const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo'); // Assuming this is for separate promo images model

const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Node.js file system module for deleting old files

// --- Multer Configuration for Local Storage ---
const storage = multer.diskStorage({
    // Destination for storing uploaded files
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        // Create 'uploads' directory if it doesn't exist
        // Note: On many cloud hosting platforms (like Render, Heroku), 
        // writing to the local filesystem like this is often temporary (ephemeral)
        // and files will be lost on server restarts or scaling events.
        // For production, consider using cloud storage (AWS S3, Google Cloud Storage, Cloudinary, etc.).
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

// Initialize Multer upload instance
const upload = multer({
    storage: storage,
    // File filter to accept only video files for products.
    // Images are still allowed for promo images, as the 'upload' instance is reused there.
    fileFilter: (req, file, cb) => {
        // This filter applies to all routes using this 'upload' instance.
        // If 'images' are picked for promo, they will be allowed.
        // If 'videos' are picked for products, they will be allowed.
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
        const promoImages = await PromoImage.find({}, 'images');

        const allImages = promoImages.flatMap(promo =>
            promo.images.map(img => `https://sheeka.onrender.com${img}`)
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
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        const images = req.files.map(file => `/uploads/${file.filename}`);

        const newPromoImage = new PromoImage({
            images,
        });

        await newPromoImage.save();

        res.status(201).json(newPromoImage);
    } catch (error) {
        console.error('❌ Error uploading promo images:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * @desc Delete a promotional image by ID and its associated files
 * @route DELETE /api/products/promo/:id
 * @access Private (admin)
 */
exports.deletePromoImage = async (req, res) => {
    try {
        const promoImageId = req.params.id;
        const promoImage = await PromoImage.findById(promoImageId);

        if (!promoImage) {
            return res.status(404).json({ message: 'Promo image not found in database.' });
        }

        promoImage.images.forEach(imagePath => {
            const filePath = path.join(__dirname, '..', imagePath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted file: ${filePath}`);
            } else {
                console.warn(`File not found, could not delete: ${filePath}`);
            }
        });

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

        if (!name || !description || !quantity || !price) {
            return res.status(400).json({ error: 'All fields (name, description, quantity, price) are required.' });
        }

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

        const images = []; // Images array will remain empty if only videos are sent
        const videos = [];

        // Correctly handle req.files which is an object when using upload.fields
        if (req.files) {
            // Note: If you only want to send videos for products, the 'images' field
            // from the frontend will likely be empty.
            if (req.files['images']) { 
                req.files['images'].forEach(file => {
                    images.push(`/uploads/${file.filename}`);
                });
            }
            if (req.files['videos']) { // Handle videos
                req.files['videos'].forEach(file => {
                    videos.push(`/uploads/${file.filename}`);
                });
            }
        }

        const newProduct = new Product({
            name,
            description,
            quantity: parseInt(quantity),
            price: parseFloat(price),
            images, // Images might be empty here
            videos, // Videos will be stored here
            variants: parsedVariants,
        });

        await newProduct.save();

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
        const products = await Product.find().sort({ createdAt: -1 });

        const updatedProducts = products.map(product => ({
            ...product._doc,
            images: product.images ? product.images.map(img => `https://sheeka.onrender.com${img}`) : [],
            videos: product.videos ? product.videos.map(vid => `https://sheeka.onrender.com${vid}`) : [], // Map video URLs to full URLs
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

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const { name, description, quantity, price, variants } = req.body;

        if (name !== undefined) product.name = name;
        if (description !== undefined) product.description = description;
        if (quantity !== undefined) product.quantity = parseInt(quantity);
        if (price !== undefined) product.price = parseFloat(price);

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

        // Restore and correctly handle file uploads (images and videos) for update
        if (req.files) {
            if (req.files['images'] && req.files['images'].length > 0) {
                // Delete old image files from disk
                product.images.forEach(oldImagePath => {
                    const filePath = path.join(__dirname, '..', oldImagePath);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted old image file: ${filePath}`);
                    } else {
                        console.warn(`Old image file not found for deletion: ${filePath}`);
                    }
                });
                product.images = req.files['images'].map(file => `/uploads/${file.filename}`);
            }
            if (req.files['videos'] && req.files['videos'].length > 0) { // Handle videos update
                // Delete old video files from disk
                product.videos.forEach(oldVideoPath => {
                    const filePath = path.join(__dirname, '..', oldVideoPath);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted old video file: ${filePath}`);
                    } else {
                        console.warn(`Old video file not found for deletion: ${filePath}`);
                    }
                });
                product.videos = req.files['videos'].map(file => `/uploads/${file.filename}`);
            }
        }

        await product.save();

        const updatedProductResponse = {
            ...product._doc,
            images: product.images ? product.images.map(img => `https://sheeka.onrender.com${img}`) : [],
            videos: product.videos ? product.videos.map(vid => `https://sheeka.onrender.com${vid}`) : [], // Map video URLs to full URLs
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
            images: product.images ? product.images.map(img => `https://sheeka.onrender.com${img}`) : [],
            videos: product.videos ? product.videos.map(vid => `https://sheeka.onrender.com${vid}`) : [], // Map video URLs to full URLs
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
            const filePath = path.join(__dirname, '..', imagePath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted product image file: ${filePath}`);
            } else {
                console.warn(`Product image file not found for deletion: ${filePath}`);
            }
        });

        // Delete associated video files from disk
        product.videos.forEach(videoPath => {
            const filePath = path.join(__dirname, '..', videoPath);
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
    { name: 'images', maxCount: 10 }, // Up to 10 images (still allowed but not required for product creation)
    { name: 'videos', maxCount: 5 }   // Up to 5 videos
]);

// Also export the 'upload' instance itself for use with .array() or .single() in routes,
// particularly for the /promo endpoint.
exports.upload = upload;
