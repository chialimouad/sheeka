// Required Modules
const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const PromoImage = require('../models/imagespromo'); // Assuming this model exists
const Collection = require('../models/Collection'); // Assuming this model exists

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose'); // Already imported, good.

// Base URL for image serving (should ideally be from environment variables)
const BASE_URL = 'https://sheeka.onrender.com';

// =========================
// 📦 Multer Setup
// =========================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the uploads directory exists
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize filename to avoid issues
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
        cb(null, fileName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images (jpeg, jpg, png, gif) are allowed!'));
    }
});

exports.upload = upload; // For product images
exports.uploadPromo = upload; // Reuse the same multer instance for promo images as they have similar requirements

// Middleware to extract client ID from JWT token
const authenticateClient = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mouadsecret');
            req.client = { clientId: decoded.id };
            // Optionally, fetch full user details if needed in subsequent middleware/handlers
            // req.user = await User.findById(decoded.id);
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
    } else {
        // If no token provided but route requires it, block.
        // For routes that are optionally authenticated, this `else` might be removed.
        // This middleware is applied globally or on specific routes, so handle accordingly.
    }
    next();
};

// =========================
// 📸 Promo Image Handlers
// =========================

// GET: Product promo images (e.g., for hero section background)
exports.getProductImagesOnly = async (req, res) => {
    try {
        // Fetching only one promo image for the hero section as per frontend consumption
        const promo = await PromoImage.findOne({}, 'images').sort({ createdAt: -1 }); // Get the latest one

        if (!promo || !promo.images || promo.images.length === 0) {
            return res.status(404).json({ message: 'No promo images found.' });
        }

        // Return only the first image from the latest promo, absolutized
        const imageUrl = `${BASE_URL}${promo.images[0]}`;
        res.json([imageUrl]); // Return as an array to match frontend's expected format
    } catch (error) {
        console.error('❌ Error fetching promo images:', error);
        res.status(500).json({ message: 'Error fetching promo images', error: error.message });
    }
};

// POST: Upload promo images
exports.uploadPromoImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        // Map relative paths to absolute URLs for storage or just relative paths
        const images = req.files.map(file => `/uploads/${file.filename}`);
        const newPromo = new PromoImage({ images });
        await newPromo.save();

        // Return the saved promo document with absolute image URLs
        const populatedPromo = {
            ...newPromo._doc,
            images: newPromo.images.map(img => `${BASE_URL}${img}`)
        };
        res.status(201).json(populatedPromo);
    } catch (error) {
        console.error('❌ Error uploading promo images:', error);
        res.status(500).json({ error: error.message });
    }
};

// DELETE: Delete a specific promo image by URL
exports.deletePromoImage = async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ message: 'Image URL is required' });
        }

        // Extract relative path from the absolute URL
        const urlObj = new URL(imageUrl);
        const relativePath = urlObj.pathname;
        const filePath = path.join(__dirname, '..', relativePath);

        // Check if file exists on disk before attempting to delete
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, async (err) => {
                if (err) {
                    console.error('❌ Failed to delete image from disk:', err);
                    return res.status(500).json({ message: 'Failed to delete image from disk' });
                }

                // Remove the image path from all PromoImage documents
                await PromoImage.updateMany({}, { $pull: { images: relativePath } });
                // Delete any PromoImage documents that become empty
                await PromoImage.deleteMany({ images: { $size: 0 } });

                res.json({ message: '✅ Image deleted successfully from disk and DB' });
            });
        } else {
            // If file doesn't exist on disk, still attempt to remove from DB for consistency
            const dbResult = await PromoImage.updateMany({}, { $pull: { images: relativePath } });
            await PromoImage.deleteMany({ images: { $size: 0 } });
            if (dbResult.modifiedCount > 0) {
                res.status(200).json({ message: 'Image not found on disk, but removed from DB.' });
            } else {
                res.status(404).json({ message: 'Image not found on disk or in DB.' });
            }
        }
    } catch (error) {
        console.error('❌ Server error during deletePromoImage:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// =========================
// 🏢 Product Handlers
// =========================
exports.addProduct = async (req, res) => {
    try {
        const { name, description, quantity, price, variants } = req.body;

        // Ensure required fields are present
        if (!name || !description || quantity === undefined || price === undefined) {
            // quantity and price can be 0, so check for undefined/null
            return res.status(400).json({ error: 'Name, description, quantity, and price are required.' });
        }

        // Ensure quantity and price are numbers
        if (isNaN(quantity) || isNaN(price)) {
            return res.status(400).json({ error: 'Quantity and price must be numbers.' });
        }

        let parsedVariants = [];
        if (variants) {
            try {
                parsedVariants = JSON.parse(variants);
                if (!Array.isArray(parsedVariants)) {
                    return res.status(400).json({ error: 'Variants should be a JSON array.' });
                }
                // Basic validation for variant structure if needed
                for (const variant of parsedVariants) {
                    if (typeof variant !== 'object' || variant === null || !('color' in variant) || !('size' in variant)) {
                        return res.status(400).json({ error: 'Each variant must be an object with color and size.' });
                    }
                }
            } catch (parseError) {
                return res.status(400).json({ error: `Invalid variants JSON format: ${parseError.message}` });
            }
        }

        // Handle uploaded images for products
        const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        const newProduct = new Product({
            name,
            description,
            quantity: Number(quantity), // Ensure quantity is stored as a number
            price: Number(price),       // Ensure price is stored as a number
            images,
            variants: parsedVariants
        });

        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('❌ Add product error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    const updatedProducts = products.map(p => ({
      ...p._doc,
      images: Array.isArray(p.images) 
        ? p.images.map(img => `${BASE_URL}${img}`) 
        : []
    }));
    res.json(updatedProducts);
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};


// GET: Single product by ID with absolute image URLs
exports.getProductById = async (req, res) => {
    console.log('📥 getProductById called with id:', req.params.id); // DEBUG

    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        res.json({
            ...product._doc,
            // Ensure images are always an array and mapped to absolute URLs
            images: Array.isArray(product.images) ? product.images.map(img => `${BASE_URL}${img}`) : []
        });
    } catch (error) {
        console.error('❌ getProductById failed:', error);
        // Check if it's a CastError (invalid MongoDB ID)
        if (error instanceof mongoose.CastError) {
            return res.status(400).json({ error: 'Invalid Product ID format.' });
        }
        res.status(500).json({ error: error.message });
    }
};

// PATCH: Update product details (excluding images and variants for simplicity, as they need special handling with multer)
exports.updateProduct = async (req, res) => {
    try {
        const { name, description, quantity, price } = req.body;
        const updatedFields = {};

        if (name !== undefined) updatedFields.name = name;
        if (description !== undefined) updatedFields.description = description;
        if (quantity !== undefined) updatedFields.quantity = Number(quantity); // Ensure number type
        if (price !== undefined) updatedFields.price = Number(price);       // Ensure number type

        if (Object.keys(updatedFields).length === 0) {
            return res.status(400).json({ message: 'No fields provided to update.' });
        }

        const product = await Product.findByIdAndUpdate(req.params.id, updatedFields, { new: true, runValidators: true });
        if (!product) return res.status(404).json({ error: 'Product not found' });

        // Return updated product with absolute image URLs
        const updatedAndPopulatedProduct = {
            ...product._doc,
            images: Array.isArray(product.images) ? product.images.map(img => `${BASE_URL}${img}`) : []
        };

        res.json({ message: 'Product updated successfully', product: updatedAndPopulatedProduct });
    } catch (error) {
        console.error('❌ Update product error:', error);
        // Handle CastError for invalid IDs
        if (error instanceof mongoose.CastError) {
            return res.status(400).json({ error: 'Invalid Product ID format.' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        // Optionally, delete associated images from disk
        if (product.images && product.images.length > 0) {
            product.images.forEach(imagePath => {
                const filePath = path.join(__dirname, '..', imagePath);
                fs.unlink(filePath, (err) => {
                    if (err) console.warn(`⚠️ Failed to delete product image from disk: ${filePath}, Error: ${err.message}`);
                });
            });
        }

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('❌ Delete product error:', error);
        // Handle CastError for invalid IDs
        if (error instanceof mongoose.CastError) {
            return res.status(400).json({ error: 'Invalid Product ID format.' });
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
                select: 'name images price',
            })
            .lean();

        const updatedCollections = collections.map((collection, i) => {
            try {
                const populatedProducts = Array.isArray(collection.productIds)
                    ? collection.productIds
                          .filter(product => product && typeof product === 'object')
                          .map(product => {
                              const images = Array.isArray(product.images)
                                  ? product.images
                                        .filter(img => typeof img === 'string')
                                        .map(img => `${BASE_URL}${img}`) // Absolutize product images
                                  : [];

                              return {
                                  _id: product._id,
                                  name: product.name,
                                  price: product.price,
                                  images,
                              };
                          })
                    : [];

                return {
                    _id: collection._id,
                    name: collection.name,
                    // Absolutize the collection thumbnail URL
                    thumbnailUrl: typeof collection.thumbnailUrl === 'string' && collection.thumbnailUrl.trim() !== ''
                        ? `${BASE_URL}${collection.thumbnailUrl}`
                        : 'https://placehold.co/150x150/EEEEEE/333333?text=No+Image', // Fallback for missing/invalid thumbnail
                    productIds: populatedProducts,
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt,
                };
            } catch (err) {
                console.error(`❌ Error processing collection at index ${i}:`, err);
                // Return a fallback collection object in case of error during processing a specific collection
                return {
                    _id: collection._id,
                    name: collection.name || 'Error Collection',
                    thumbnailUrl: 'https://placehold.co/150x150/EEEEEE/333333?text=Error',
                    productIds: [],
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt,
                    error: err.message // Add error detail for debugging
                };
            }
        });

        res.json(updatedCollections);
    } catch (error) {
        console.error('❌ Error fetching collections:', error);
        res.status(500).json({
            message: 'Server error fetching collections',
            error: error.message,
        });
    }
};

exports.addCollection = async (req, res) => {
    try {
        const { name, thumbnailUrl, productIds } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Collection name is required.' });
        }

        if (productIds && !Array.isArray(productIds)) {
            return res.status(400).json({ error: 'productIds must be an array.' });
        }

        // Validate productIds are valid Mongoose ObjectIds if provided
        if (productIds && productIds.length > 0) {
            const invalidIds = productIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({ error: `Invalid product IDs provided: ${invalidIds.join(', ')}` });
            }
            // Optional: Verify if productIds actually exist in the Product collection
            const existingProducts = await Product.find({ '_id': { $in: productIds } });
            if (existingProducts.length !== productIds.length) {
                const foundIds = existingProducts.map(p => p._id.toString());
                const notFoundIds = productIds.filter(id => !foundIds.includes(id));
                return res.status(400).json({ message: `One or more products not found: ${notFoundIds.join(', ')}` });
            }
        }

        const newCollection = new Collection({
            name,
            thumbnailUrl, // Assuming this is already a relative path or will be handled by the frontend
            productIds: productIds || [],
        });

        await newCollection.save();
        res.status(201).json(newCollection);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Collection with this name already exists.' });
        }
        console.error('❌ Add collection error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateCollection = async (req, res) => {
    try {
        const { name, thumbnailUrl, productIds } = req.body;
        const updatedFields = {};

        if (name !== undefined) updatedFields.name = name;
        if (thumbnailUrl !== undefined) updatedFields.thumbnailUrl = thumbnailUrl; // Assuming this is a relative path or absolute
        if (productIds !== undefined) {
            if (!Array.isArray(productIds)) {
                return res.status(400).json({ error: 'productIds must be an array.' });
            }
            // Validate productIds are valid Mongoose ObjectIds
            const invalidIds = productIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({ error: `Invalid product IDs provided: ${invalidIds.join(', ')}` });
            }
             // Optional: Verify if productIds actually exist
            const existingProducts = await Product.find({ '_id': { $in: productIds } });
            if (existingProducts.length !== productIds.length) {
                const foundIds = existingProducts.map(p => p._id.toString());
                const notFoundIds = productIds.filter(id => !foundIds.includes(id));
                return res.status(400).json({ message: `One or more products not found: ${notFoundIds.join(', ')}` });
            }
            updatedFields.productIds = productIds;
        }

        if (Object.keys(updatedFields).length === 0) {
            return res.status(400).json({ message: 'No fields provided to update.' });
        }

        const collection = await Collection.findByIdAndUpdate(req.params.id, updatedFields, { new: true, runValidators: true });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        res.json({ message: 'Collection updated successfully', collection });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Collection with this name already exists.' });
        }
        console.error('❌ Update collection error:', error);
        // Handle CastError for invalid IDs
        if (error instanceof mongoose.CastError) {
            return res.status(400).json({ error: 'Invalid Collection ID format.' });
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
        console.error('❌ Delete collection error:', error);
        // Handle CastError for invalid IDs
        if (error instanceof mongoose.CastError) {
            return res.status(400).json({ error: 'Invalid Collection ID format.' });
        }
        res.status(500).json({ error: error.message });
    }
};
