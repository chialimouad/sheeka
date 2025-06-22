// controllers/productController.js
const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo'); // Assuming this model exists
const Collection = require('../models/Collection'); // Assuming this model exists
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// =========================
// 📦 Multer Setup
// =========================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Construct the absolute path to the 'uploads' directory
        // This ensures files are saved at the root of your application
        const uploadDir = path.join(__dirname, '..', 'uploads');
        
        // Ensure the 'uploads/' directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true }); // Create recursively if parent directories don't exist
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const safeFilename = file.originalname
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/[^a-zA-Z0-9._-]/g, ''); // Remove non-allowed characters
        cb(null, `${Date.now()}-${safeFilename}`);
    },
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

        // Extract relative path from the full URL
        const relativePath = new URL(imageUrl).pathname;
        const filePath = path.join(__dirname, '..', relativePath); // Path to the file on disk

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File does not exist on disk' });
        }

        fs.unlink(filePath, async (err) => {
            if (err) {
                console.error('Error deleting image from disk:', err);
                return res.status(500).json({ message: 'Failed to delete image from disk' });
            }

            // Remove the image path from any PromoImage documents
            const dbResult = await PromoImage.updateMany({}, { $pull: { images: relativePath } });
            // Delete any PromoImage documents that now have no images
            await PromoImage.deleteMany({ images: { $size: 0 } });

            res.json({ message: '✅ Image deleted', dbResult });
        });
    } catch (error) {
        console.error('Server error during promo image deletion:', error);
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
            return res.status(400).json({ error: 'All product fields (name, description, quantity, price) are required' });
        }

        let parsedVariants = [];
        if (variants) {
            try {
                parsedVariants = JSON.parse(variants);
                if (!Array.isArray(parsedVariants)) {
                    return res.status(400).json({ error: 'Variants should be a JSON array' });
                }
            } catch (parseError) {
                return res.status(400).json({ error: 'Invalid variants format: Must be a valid JSON array string' });
            }
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'At least one image is required for a product' });
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
        console.error('Error adding product:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        // Map images to full URLs
        const updatedProducts = products.map(p => ({
            ...p._doc, // Get the plain JavaScript object from Mongoose document
            images: p.images.map(img => `https://sheeka.onrender.com${img}`)
        }));
        res.json(updatedProducts);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

exports.getProductById = async (req, res) => {
    console.log('📥 getProductById called with id:', req.params.id); // DEBUG

    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        res.json({
            ...product._doc,
            images: product.images.map(img => `https://sheeka.onrender.com${img}`)
        });
    } catch (error) {
        console.error('❌ getProductById failed:', error);
        // Check for invalid MongoDB ID format
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ error: 'Invalid Product ID format' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { name, description, quantity, price } = req.body;
        // Only update fields provided in the body
        const updatedFields = {};
        if (name) updatedFields.name = name;
        if (description) updatedFields.description = description;
        if (quantity) updatedFields.quantity = quantity;
        if (price) updatedFields.price = price;

        const product = await Product.findByIdAndUpdate(req.params.id, updatedFields, { new: true, runValidators: true });
        if (!product) return res.status(404).json({ error: 'Product not found' });

        res.json({ message: 'Product updated successfully', product });
    } catch (error) {
        console.error('Error updating product:', error);
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ error: 'Invalid Product ID format' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        // Optional: Delete associated image files from disk
        // This part assumes your Product model stores relative paths like '/uploads/filename.jpg'
        if (product.images && product.images.length > 0) {
            product.images.forEach(imagePath => {
                const filePath = path.join(__dirname, '..', imagePath);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.warn(`⚠️ Failed to delete image file from disk: ${filePath}`, err);
                        // Log the error but don't prevent deletion from DB
                    } else {
                        console.log(`🗑️ Deleted image file: ${filePath}`);
                    }
                });
            });
        }

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ error: 'Invalid Product ID format' });
        }
        res.status(500).json({ error: error.message });
    }
};

// =========================
// 🛒 Collection Handlers
// =========================
exports.getCollections = async (req, res) => {
    try {
        const collections = await Collection.find()
            .populate({
                path: 'productIds',
                select: 'name images price', // Select specific fields from populated products
            })
            .lean(); // Use .lean() for faster execution if you don't need Mongoose document methods

        const updatedCollections = collections.map((collection, i) => {
            try {
                const populatedProducts = Array.isArray(collection.productIds)
                    ? collection.productIds
                        .filter(product => product && typeof product === 'object' && product.name && product.price && Array.isArray(product.images)) // Ensure product is a valid object and has images array
                        .map(product => {
                            const images = Array.isArray(product.images)
                                ? product.images
                                    .filter(img => typeof img === 'string' && img.trim() !== '') // Filter out non-string or empty image paths
                                    .map(img => `https://sheeka.onrender.com${img}`)
                                : []; // Default to empty array if images is not an array

                            return {
                                _id: product._id,
                                name: product.name,
                                price: product.price,
                                images,
                            };
                        })
                    : []; // Default to empty array if productIds is not an array

                return {
                    _id: collection._id,
                    name: collection.name,
                    // Provide a fallback placeholder image if thumbnailUrl is missing or invalid
                    thumbnailUrl: typeof collection.thumbnailUrl === 'string' && collection.thumbnailUrl.trim() !== ''
                        ? collection.thumbnailUrl
                        : 'https://placehold.co/150x150/EEEEEE/333333?text=No+Image',
                    productIds: populatedProducts,
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt,
                };
            } catch (err) {
                console.error(`❌ Error processing collection at index ${i} (ID: ${collection._id}):`, err);
                // Return a simplified object for the problematic collection to avoid breaking the entire response
                return {
                    _id: collection._id,
                    name: collection.name || 'Unknown Collection',
                    thumbnailUrl: 'https://placehold.co/150x150/EEEEEE/333333?text=Error',
                    productIds: [],
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt,
                    error: 'Error processing collection data'
                };
            }
        });

        res.json(updatedCollections);
    } catch (error) {
        console.error('❌ Error fetching collections:', error);
        res.status(500).json({
            message: 'Error fetching collections',
            error: error.message,
        });
    }
};

exports.addCollection = async (req, res) => {
    try {
        const { name, thumbnailUrl, productIds } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Collection name is required.' });
        }

        // Validate productIds if provided
        if (productIds && (!Array.isArray(productIds) || !productIds.every(id => mongoose.Types.ObjectId.isValid(id)))) {
            return res.status(400).json({ error: 'productIds must be an array of valid MongoDB Object IDs.' });
        }

        const newCollection = new Collection({
            name,
            thumbnailUrl: thumbnailUrl || 'https://placehold.co/150x150/EEEEEE/333333?text=No+Image', // Default thumbnail
            productIds: productIds || [],
        });

        await newCollection.save();
        res.status(201).json(newCollection);
    } catch (error) {
        console.error('Error adding collection:', error);
        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({ error: 'Collection with this name already exists.' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.updateCollection = async (req, res) => {
    try {
        const { name, thumbnailUrl, productIds } = req.body;

        const updatedFields = {};
        if (name) updatedFields.name = name;
        if (thumbnailUrl) updatedFields.thumbnailUrl = thumbnailUrl;
        if (productIds && Array.isArray(productIds)) {
            if (!productIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
                return res.status(400).json({ error: 'productIds must be an array of valid MongoDB Object IDs.' });
            }
            updatedFields.productIds = productIds;
        }


        const collection = await Collection.findByIdAndUpdate(req.params.id, updatedFields, { new: true, runValidators: true });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        res.json({ message: 'Collection updated successfully', collection });
    } catch (error) {
        console.error('Error updating collection:', error);
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Collection with this name already exists.' });
        }
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ error: 'Invalid Collection ID format' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.deleteCollection = async (req, res) => {
    try {
        const collection = await Collection.findByIdAndDelete(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        res.json({ message: 'Collection deleted successfully' });
    } catch (error) {
        console.error('Error deleting collection:', error);
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ error: 'Invalid Collection ID format' });
        }
        res.status(500).json({ error: error.message });
    }
};
