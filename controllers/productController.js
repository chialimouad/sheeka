const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');
const Collection = require('../models/Collection'); // Import the Collection model
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

exports.deletePromoImage = async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ message: 'Image URL is required' });
        }

        // Step 1: Get relative path
        const relativePath = new URL(imageUrl).pathname; // e.g. /uploads/123-file.png

        // Step 2: Build correct absolute path
        const filePath = path.join(__dirname, '..', relativePath); // safe relativePath

        console.log('🧩 Trying to delete:', filePath);

        // Step 3: Check existence
        if (!fs.existsSync(filePath)) {
            console.error('🚫 File not found:', filePath);
            return res.status(404).json({ message: 'File does not exist on disk' });
        }

        // Step 4: Delete file from disk
        fs.unlink(filePath, async (err) => {
            if (err) {
                console.error('❌ File deletion error:', err);
                return res.status(500).json({ message: 'Failed to delete image from disk' });
            }

            // Step 5: Remove from DB
            const dbResult = await PromoImage.updateMany({}, { $pull: { images: relativePath } });

            // Step 6: Remove empty promo documents
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

// =========================
// 🛒 Collection Handlers
// =========================

// Add a new collection
exports.addCollection = async (req, res) => {
    try {
        const { name, thumbnailUrl, productIds } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Collection name is required.' });
        }

        if (productIds && !Array.isArray(productIds)) {
            return res.status(400).json({ error: 'productIds must be an array.' });
        }

        const newCollection = new Collection({
            name,
            thumbnailUrl,
            productIds: productIds || []
        });

        await newCollection.save();
        res.status(201).json(newCollection);
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error for unique 'name'
            return res.status(409).json({ error: 'Collection with this name already exists.' });
        }
        res.status(500).json({ error: error.message });
    }
};

// Get all collections
exports.getCollections = async (req, res) => {
    try {
        // Populate productIds to get product details, selecting only specific fields
        // Use `lean()` for faster queries when you don't need Mongoose documents methods
        const collections = await Collection.find().populate({
            path: 'productIds',
            select: 'name images price',
            // If a product ID doesn't exist, it will be null in the populated array.
            // You can optionally match only existing products if you prefer:
            // match: { _id: { $ne: null } }
        }).lean(); // Add .lean() for plain JavaScript objects, often improves performance

        const updatedCollections = collections.map(collection => {
            // Ensure productIds is an array and filter out any null products
            const populatedProducts = (collection.productIds || [])
                .filter(product => product != null) // Filter out nulls from failed population
                .map(product => {
                    // Ensure 'images' property exists and is an array before mapping
                    const images = (product.images && Array.isArray(product.images))
                        ? product.images.map(img => `https://sheeka.onrender.com${img}`)
                        : []; // Default to empty array if images is missing or not an array

                    return {
                        ...product, // Use product directly if .lean() is used
                        images: images
                    };
                });

            return {
                ...collection, // Use collection directly if .lean() is used
                productIds: populatedProducts,
                // Add a default for thumbnailUrl if it might be null/undefined for client
                thumbnailUrl: collection.thumbnailUrl || 'https://placehold.co/150x150/EEEEEE/333333?text=No+Image'
            };
        });
        res.json(updatedCollections);
    } catch (error) {
        // Log the full error stack for better debugging on the server
        console.error('❌ Error fetching collections:', error);
        res.status(500).json({ message: 'Error fetching collections', error: error.message });
    }
};

// Update a collection
exports.updateCollection = async (req, res) => {
    try {
        const { name, thumbnailUrl, productIds } = req.body;
        const updatedFields = { name, thumbnailUrl, productIds };

        const collection = await Collection.findByIdAndUpdate(req.params.id, updatedFields, { new: true });
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        res.json({ message: 'Collection updated successfully', collection });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Collection with this name already exists.' });
        }
        res.status(500).json({ error: error.message });
    }
};

// Delete a collection
exports.deleteCollection = async (req, res) => {
    try {
        const collection = await Collection.findByIdAndDelete(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        res.json({ message: 'Collection deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
