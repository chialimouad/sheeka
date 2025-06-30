/**
 * @fileoverview Handles API logic for pixel ID management and site configuration.
 */

const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo'); // Assuming this model exists
const Collection = require('../models/Collection'); // Assuming this model exists
const SiteConfig = require('../models/sitecontroll'); // Corrected model import name
const multer = require('multer');
const path = require('path'); // Not strictly needed with Cloudinary storage
const fs = require('fs'); // Not strictly needed with Cloudinary storage
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables

// =========================
// 📦 Multer Setup
// =========================

// ✅ Cloudinary Config
// IMPORTANT: Move these credentials to environment variables for production!
// Example: process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'di1u2ssnm',
    api_key: process.env.CLOUDINARY_API_KEY || '382166879473993',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'R4mh6IC2ilC88VKiTFPyyxtBeFU',
});

// ✅ Multer + Cloudinary Storage Setup
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'sheeka_products', // Folder in Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, crop: 'limit' }], // Optimize image size
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // Limit file size to 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const mimeType = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

        if (mimeType && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and WebP image files are allowed.'));
        }
    }
});

exports.upload = upload;
exports.uploadPromo = upload; // Reusing the same upload configuration for promo images

// =========================
// 📸 Promo Image Handlers
// =========================

/**
 * @desc Fetches all promo image URLs from the database.
 * @route GET /api/promo-images
 * @access Public (or private if only for admin dashboard)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.getProductImagesOnly = async (req, res) => {
    try {
        console.log('Backend: Attempting to fetch promo images...');
        // Select only the 'images' field for efficiency
        const promos = await PromoImage.find({}, 'images').lean(); // Use .lean() for faster query execution

        // Ensure images are indeed arrays and filter out invalid entries before flatMap
        const allImages = promos.flatMap(p => {
            if (p && Array.isArray(p.images)) {
                // Filter out any non-string or empty string entries within the array
                return p.images.filter(img => typeof img === 'string' && img.trim() !== '');
            }
            return []; // Return an empty array if 'images' is not an array or is null/undefined
        });

        console.log(`Backend: Processed ${allImages.length} promo images.`);

        if (allImages.length === 0) {
            console.log('Backend: No promo images found, sending empty array.');
            return res.status(200).json([]); // Explicitly send an empty array with 200 OK
        }

        res.status(200).json(allImages);
        console.log('Backend: Successfully sent promo images.');

    } catch (error) {
        console.error('❌ Backend: Error fetching promo images:', error.message);
        // Improve error response: Send 500 for server errors, log detailed error
        res.status(500).json({ message: 'Internal Server Error fetching promo images. Please try again.' });
    }
};


/**
 * @desc Uploads new promo images to Cloudinary and saves their URLs to the database.
 * @route POST /api/promo-images/upload
 * @access Private (should be protected with authentication/authorization)
 * @param {object} req - Express request object (expects files from multer).
 * @param {object} res - Express response object.
 */
exports.uploadPromoImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No images uploaded. Please select at least one image file.' });
        }

        const images = req.files.map(file => file.path); // Cloudinary gives you full URLs
        const newPromo = new PromoImage({ images });
        await newPromo.save();
        res.status(201).json({
            message: 'Promo images uploaded and saved successfully!',
            promo: newPromo
        });
    } catch (error) {
        console.error('Error uploading promo images:', error.message);
        res.status(500).json({ message: 'Failed to upload promo images. Please try again.', error: error.message });
    }
};

/**
 * @desc Deletes a specific promo image from Cloudinary and removes its reference from the database.
 * @route DELETE /api/promo-images/delete
 * @access Private (should be protected with authentication/authorization)
 * @param {object} req - Express request object (expects image URL in query).
 * @param {object} res - Express response object.
 */
exports.deletePromoImage = async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ message: 'Image URL is required for deletion.' });
        }

        // Robustly extract public ID from the Cloudinary URL.
        // This regex handles various Cloudinary URL formats and ensures correct publicId extraction.
        const publicIdMatch = imageUrl.match(/(?:upload\/v\d+\/)(.+?)(?:\.\w{3,4})?$/);
        let publicId = '';

        if (publicIdMatch && publicIdMatch[1]) {
            // publicIdMatch[1] would be 'folder/image_name' or 'folder/image_name.ext'
            publicId = publicIdMatch[1].replace(/\.\w{3,4}$/, ''); // Remove extension if present
        }

        if (!publicId) {
            return res.status(400).json({ message: 'Could not extract a valid Cloudinary public ID from the provided image URL.' });
        }

        let cloudinaryDeletionResult = { result: 'not_attempted' };
        try {
            // Delete from Cloudinary
            cloudinaryDeletionResult = await cloudinary.uploader.destroy(publicId);

            if (cloudinaryDeletionResult.result !== 'ok' && cloudinaryDeletionResult.result !== 'not found') {
                console.warn(`⚠️ Cloudinary deletion warning for ${publicId}:`, cloudinaryDeletionResult);
                // Continue to DB update even if Cloudinary reports an issue other than 'not found'
            } else if (cloudinaryDeletionResult.result === 'ok') {
                console.log(`🗑️ Deleted image from Cloudinary: ${publicId}`);
            } else if (cloudinaryDeletionResult.result === 'not found') {
                console.log(`ℹ️ Image not found on Cloudinary, proceeding with DB update: ${publicId}`);
            }
        } catch (cloudinaryError) {
            console.error(`❌ Error during Cloudinary deletion for ${publicId}:`, cloudinaryError.message);
            // Log the error but don't stop the process, try to update DB
        }

        // Remove the image path from any PromoImage documents
        // Using $pull to remove the specific URL from the 'images' array across all documents
        const dbResult = await PromoImage.updateMany(
            { images: imageUrl }, // Find documents where this image URL exists
            { $pull: { images: imageUrl } } // Remove the URL from the 'images' array
        );

        // Delete any PromoImage documents that now have no images left in their array
        await PromoImage.deleteMany({ images: { $size: 0 } });

        res.status(200).json({
            message: '✅ Image deletion process completed.',
            cloudinaryResult: cloudinaryDeletionResult,
            databaseUpdateResult: dbResult
        });
    } catch (error) {
        console.error('Server error during promo image deletion:', error.message);
        res.status(500).json({ message: 'Server error during promo image deletion. Please try again.', error: error.message });
    }
};


// =========================
// 🏢 Product Handlers
// =========================

/**
 * @desc Adds a new product to the database, including image uploads to Cloudinary.
 * @route POST /api/products
 * @access Private (should be protected with authentication/authorization)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.addProduct = async (req, res) => {
    try {
        const { name, description, quantity, price, variants } = req.body;

        // Basic validation for required fields
        if (!name || !description || quantity === undefined || price === undefined) {
            return res.status(400).json({ message: 'Product name, description, quantity, and price are required.' });
        }

        // Validate quantity and price as numbers and non-negative
        const parsedQuantity = Number(quantity);
        const parsedPrice = Number(price);

        if (isNaN(parsedQuantity) || parsedQuantity < 0) {
            return res.status(400).json({ message: 'Quantity must be a non-negative number.' });
        }
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ message: 'Price must be a non-negative number.' });
        }

        let parsedVariants = [];
        if (variants) {
            try {
                parsedVariants = JSON.parse(variants);
                if (!Array.isArray(parsedVariants)) {
                    return res.status(400).json({ message: 'Variants should be a JSON array string.' });
                }
                // Optional: Further validate each variant object structure if needed
            } catch (parseError) {
                return res.status(400).json({ message: 'Invalid variants format: Must be a valid JSON array string.', error: parseError.message });
            }
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'At least one image is required for a product.' });
        }
        // When using Cloudinary, `file.path` already contains the full URL
        const images = req.files.map(file => file.path);

        const newProduct = new Product({
            name,
            description,
            quantity: parsedQuantity,
            price: parsedPrice,
            images,
            variants: parsedVariants
        });

        await newProduct.save();
        res.status(201).json({
            message: 'Product added successfully!',
            product: newProduct
        });
    } catch (error) {
        console.error('Error adding product:', error.message);
        // Handle specific Mongoose validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to add product. Please try again.', error: error.message });
    }
};

/**
 * @desc Fetches all products from the database.
 * @route GET /api/products
 * @access Public (or private depending on use case)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }).lean(); // Use .lean() for performance
        res.status(200).json({
            message: 'Products fetched successfully!',
            products
        });
    } catch (error) {
        console.error('Error fetching products:', error.message);
        res.status(500).json({ message: 'Error fetching products. Please try again.' });
    }
};

/**
 * @desc Fetches a single product by its ID.
 * @route GET /api/products/:id
 * @access Public (or private depending on use case)
 * @param {object} req - Express request object (expects product ID in params).
 * @param {object} res - Express response object.
 */
exports.getProductById = async (req, res) => {
    const productId = req.params.id;

    // Validate if the provided ID is a valid Mongoose ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        const product = await Product.findById(productId).lean(); // Use .lean() for performance
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.status(200).json({
            message: 'Product fetched successfully!',
            product
        });
    } catch (error) {
        console.error('Error fetching product by ID:', error.message);
        res.status(500).json({ message: 'Error fetching product details. Please try again.' });
    }
};

/**
 * @desc Updates an existing product by its ID.
 * @route PUT /api/products/:id
 * @access Private (should be protected with authentication/authorization)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.updateProduct = async (req, res) => {
    const productId = req.params.id;

    // Validate if the provided ID is a valid Mongoose ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        const { name, description, quantity, price, images, variants } = req.body;

        const updatedFields = {};

        if (name !== undefined) updatedFields.name = String(name).trim();
        if (description !== undefined) updatedFields.description = String(description).trim();

        if (quantity !== undefined) {
            const parsedQuantity = Number(quantity);
            if (isNaN(parsedQuantity) || parsedQuantity < 0) {
                return res.status(400).json({ message: 'Quantity must be a non-negative number.' });
            }
            updatedFields.quantity = parsedQuantity;
        }

        if (price !== undefined) {
            const parsedPrice = Number(price);
            if (isNaN(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({ message: 'Price must be a non-negative number.' });
            }
            updatedFields.price = parsedPrice;
        }

        // Handle images update: If new images are provided, they replace old ones.
        // IMPORTANT: If you need to delete old images from Cloudinary,
        // you'd need to fetch the product first, compare image arrays,
        // and then delete the ones no longer present. This is a more complex logic.
        if (images !== undefined) {
            if (!Array.isArray(images) || !images.every(img => typeof img === 'string' && img.trim() !== '')) {
                return res.status(400).json({ message: 'Images must be an array of valid image URLs.' });
            }
            updatedFields.images = images.map(img => String(img).trim());
        }

        if (variants !== undefined) {
            let parsedVariants = [];
            try {
                // Variants might come as a stringified JSON or already as an array
                parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
                if (!Array.isArray(parsedVariants)) {
                    return res.status(400).json({ message: 'Variants should be a JSON array string or an array.' });
                }
                updatedFields.variants = parsedVariants;
            } catch (parseError) {
                return res.status(400).json({ message: 'Invalid variants format: Must be a valid JSON array string or an array.', error: parseError.message });
            }
        }

        if (Object.keys(updatedFields).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: updatedFields }, // Use $set to update only provided fields
            { new: true, runValidators: true } // Return the modified document and run schema validators
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.status(200).json({ message: 'Product updated successfully!', product });
    } catch (error) {
        console.error('Error updating product:', error.message);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to update product. Please try again.', error: error.message });
    }
};

/**
 * @desc Deletes a product by its ID and removes associated images from Cloudinary.
 * @route DELETE /api/products/:id
 * @access Private (should be protected with authentication/authorization)
 * @param {object} req - Express request object (expects product ID in params).
 * @param {object} res - Express response object.
 */
exports.deleteProduct = async (req, res) => {
    const productId = req.params.id;

    // Validate if the provided ID is a valid Mongoose ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        const product = await Product.findByIdAndDelete(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Delete associated image files from Cloudinary concurrently
        if (product.images && product.images.length > 0) {
            const deletionPromises = product.images.map(async (imageUrl) => {
                const publicIdMatch = imageUrl.match(/(?:upload\/v\d+\/)(.+?)(?:\.\w{3,4})?$/);
                let publicId = '';

                if (publicIdMatch && publicIdMatch[1]) {
                    publicId = publicIdMatch[1].replace(/\.\w{3,4}$/, '');
                }

                if (publicId) {
                    try {
                        const cloudinaryResult = await cloudinary.uploader.destroy(publicId);
                        if (cloudinaryResult.result === 'ok') {
                            console.log(`🗑️ Deleted image from Cloudinary: ${publicId}`);
                            return { publicId, status: 'success' };
                        } else {
                            console.warn(`⚠️ Cloudinary deletion failed for ${publicId}:`, cloudinaryResult);
                            return { publicId, status: 'failed', result: cloudinaryResult };
                        }
                    } catch (cloudinaryError) {
                        console.error(`❌ Error deleting image from Cloudinary ${publicId}:`, cloudinaryError.message);
                        return { publicId, status: 'error', error: cloudinaryError.message };
                    }
                } else {
                    console.warn(`⚠️ Could not extract public ID for image (skipping Cloudinary deletion): ${imageUrl}`);
                    return { publicId: null, status: 'skipped', message: 'Invalid URL for public ID extraction' };
                }
            });
            // Wait for all image deletion promises to settle
            await Promise.allSettled(deletionPromises);
        }

        res.status(200).json({ message: 'Product deleted successfully!' });
    } catch (error) {
        console.error('Error deleting product:', error.message);
        res.status(500).json({ message: 'Failed to delete product. Please try again.', error: error.message });
    }
};

// =========================
// 🛒 Collection Handlers
// =========================

/**
 * @desc Fetches all collections, populating associated product details.
 * @route GET /api/collections
 * @access Public (or private depending on use case)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.getCollections = async (req, res) => {
    try {
        console.log('Fetching collections...');
        const collections = await Collection.find()
            .populate({
                path: 'productIds',
                select: 'name images price', // Select specific fields from populated products for efficiency
            })
            .lean(); // Use .lean() for faster execution if you don't need Mongoose document methods

        console.log(`Collections fetched from DB: ${collections.length}`);

        const updatedCollections = collections.map((collection, i) => {
            try {
                // Ensure productIds is an array and filter out any null/undefined products that might result from populate
                const populatedProducts = Array.isArray(collection.productIds)
                    ? collection.productIds
                        .filter(product => {
                            // Filter conditions: product exists, is an object, has name, price, and images array
                            const isValid = product && typeof product === 'object' &&
                                product.name && product.price !== undefined && Array.isArray(product.images);
                            if (!isValid) {
                                console.warn(`⚠️ Invalid product data found in collection ID: ${collection._id}, product index: ${i}. Product will be excluded.`);
                            }
                            return isValid;
                        })
                        .map(product => {
                            const images = Array.isArray(product.images)
                                ? product.images.filter(img => typeof img === 'string' && img.trim() !== '') // Filter out non-string or empty string entries
                                : []; // Default to empty array if images is not an an array

                            return {
                                _id: product._id,
                                name: product.name,
                                price: product.price,
                                images, // Images are already full Cloudinary URLs
                            };
                        })
                    : []; // Default to empty array if productIds is not an array or is null/undefined

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
                console.error(`❌ Error processing collection data at index ${i} (ID: ${collection._id}):`, err.message);
                // Return a simplified object for the problematic collection to avoid breaking the entire response
                return {
                    _id: collection._id,
                    name: collection.name || 'Unknown Collection',
                    thumbnailUrl: 'https://placehold.co/150x150/EEEEEE/333333?text=Error',
                    productIds: [],
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt,
                    error: 'Error processing collection data on server' // More descriptive error
                };
            }
        });

        console.log(`Collections sent to client: ${updatedCollections.length}`);
        res.status(200).json(updatedCollections);
    } catch (error) {
        console.error('❌ Error fetching collections:', error.message);
        res.status(500).json({
            message: 'Error fetching collections. Please try again.',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined // Provide stack only in dev
        });
    }
};

/**
 * @desc Fetches a single collection by its ID, populating associated product details.
 * @route GET /api/collections/:id
 * @access Public (or private depending on use case)
 * @param {object} req - Express request object (expects collection ID in params).
 * @param {object} res - Express response object.
 */
exports.getCollectionById = async (req, res) => {
    const collectionId = req.params.id;

    // Validate if the provided ID is a valid Mongoose ObjectId format
    if (!mongoose.Types.ObjectId.isValid(collectionId)) {
        return res.status(400).json({ message: 'Invalid collection ID format.' });
    }

    try {
        const collection = await Collection.findById(collectionId)
            .populate({
                path: 'productIds',
                select: 'name description images price variants quantity', // Select all relevant product fields
            })
            .lean(); // Use .lean() for performance

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found.' });
        }

        // Filter out any invalid or null products after population
        collection.productIds = collection.productIds.filter(product => product && product._id);

        res.status(200).json({
            message: 'Collection fetched successfully!',
            collection
        });
    } catch (error) {
        console.error('Error fetching collection by ID:', error.message);
        res.status(500).json({ message: 'Error fetching collection details. Please try again.', error: error.message });
    }
};

/**
 * @desc Adds a new collection to the database.
 * @route POST /api/collections
 * @access Private (should be protected with authentication/authorization)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.addCollection = async (req, res) => {
    try {
        const { name, thumbnailUrl, productIds } = req.body;

        if (!name || String(name).trim() === '') {
            return res.status(400).json({ message: 'Collection name is required and cannot be empty.' });
        }

        // Validate productIds if provided
        if (productIds !== undefined) {
            if (!Array.isArray(productIds) || !productIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
                return res.status(400).json({ message: 'productIds must be an array of valid MongoDB Object IDs.' });
            }
        }

        const newCollection = new Collection({
            name: String(name).trim(),
            thumbnailUrl: thumbnailUrl ? String(thumbnailUrl).trim() : 'https://placehold.co/150x150/EEEEEE/333333?text=No+Image', // Default thumbnail
            productIds: productIds || [],
        });

        await newCollection.save();
        res.status(201).json({
            message: 'Collection added successfully!',
            collection: newCollection
        });
    } catch (error) {
        console.error('Error adding collection:', error.message);
        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({ message: 'Collection with this name already exists. Please choose a different name.' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to add collection. Please try again.', error: error.message });
    }
};

/**
 * @desc Updates an existing collection by its ID.
 * @route PUT /api/collections/:id
 * @access Private (should be protected with authentication/authorization)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.updateCollection = async (req, res) => {
    const collectionId = req.params.id;

    // Validate if the provided ID is a valid Mongoose ObjectId format
    if (!mongoose.Types.ObjectId.isValid(collectionId)) {
        return res.status(400).json({ message: 'Invalid Collection ID format.' });
    }

    try {
        const { name, thumbnailUrl, productIds } = req.body;

        const updatedFields = {};
        if (name !== undefined) updatedFields.name = String(name).trim();
        if (thumbnailUrl !== undefined) updatedFields.thumbnailUrl = String(thumbnailUrl).trim();

        if (productIds !== undefined) {
            if (!Array.isArray(productIds) || !productIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
                return res.status(400).json({ message: 'productIds must be an array of valid MongoDB Object IDs.' });
            }
            updatedFields.productIds = productIds;
        }

        if (Object.keys(updatedFields).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        const collection = await Collection.findByIdAndUpdate(
            collectionId,
            { $set: updatedFields }, // Use $set to update only provided fields
            { new: true, runValidators: true } // Return the modified document and run schema validators
        );

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found.' });
        }

        res.status(200).json({ message: 'Collection updated successfully!', collection });
    } catch (error) {
        console.error('Error updating collection:', error.message);
        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({ message: 'Collection with this name already exists. Please choose a different name.' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to update collection. Please try again.', error: error.message });
    }
};

/**
 * @desc Deletes a collection by its ID.
 * @route DELETE /api/collections/:id
 * @access Private (should be protected with authentication/authorization)
 * @param {object} req - Express request object (expects collection ID in params).
 * @param {object} res - Express response object.
 */
exports.deleteCollection = async (req, res) => {
    const collectionId = req.params.id;

    // Validate if the provided ID is a valid Mongoose ObjectId format
    if (!mongoose.Types.ObjectId.isValid(collectionId)) {
        return res.status(400).json({ message: 'Invalid Collection ID format.' });
    }

    try {
        const collection = await Collection.findByIdAndDelete(collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found.' });
        }
        res.status(200).json({ message: 'Collection deleted successfully!' });
    } catch (error) {
        console.error('Error deleting collection:', error.message);
        res.status(500).json({ message: 'Failed to delete collection. Please try again.', error: error.message });
    }
};

// =========================
// 🌐 Site Configuration Handlers
// =========================

/**
 * @desc Get site configuration
 * @route GET /api/site-config
 * @access Public (can be restricted for admin panel later)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.getSiteConfig = async (req, res) => {
    try {
        // Use the static method to get/create config, and use .lean() for performance
        const config = await SiteConfig.getSingleton().lean();
        res.status(200).json(config);
    } catch (error) {
        console.error('Error fetching site configuration:', error.message);
        res.status(500).json({ message: 'Server error fetching site configuration. Please try again.', error: error.message });
    }
};

/**
 * @desc Update site configuration
 * @route PUT /api/site-config
 * @access Private (e.g., Admin only - requires authentication/authorization)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.updateSiteConfig = async (req, res) => {
    try {
        // Find the single configuration document. If none, getSingleton will create it first.
        let config = await SiteConfig.getSingleton();

        // Destructure all possible fields from req.body
        const {
            siteName,
            slogan,
            primaryColor,
            secondaryColor,
            tertiaryColor,
            generalTextColor,
            footerBgColor,
            footerTextColor,
            footerLinkColor,
            aboutUsText,
            aboutUsImageUrl,
            socialMediaLinks,
            deliveryFees,
            currentDataIndex
        } = req.body;

        const updatedFields = {};

        // Helper function for trimming and assigning string fields
        const assignStringField = (field, value) => {
            if (value !== undefined) {
                updatedFields[field] = String(value).trim();
            }
        };

        assignStringField('siteName', siteName);
        assignStringField('slogan', slogan);
        assignStringField('primaryColor', primaryColor);
        assignStringField('secondaryColor', secondaryColor);
        assignStringField('tertiaryColor', tertiaryColor);
        assignStringField('generalTextColor', generalTextColor);
        assignStringField('footerBgColor', footerBgColor);
        assignStringField('footerTextColor', footerTextColor);
        assignStringField('footerLinkColor', footerLinkColor);
        assignStringField('aboutUsText', aboutUsText);
        assignStringField('aboutUsImageUrl', aboutUsImageUrl);

        if (socialMediaLinks !== undefined) {
            if (!Array.isArray(socialMediaLinks)) {
                return res.status(400).json({ message: 'socialMediaLinks must be an array.' });
            }
            // Validate each social media link object
            const isValidSocialMediaLinks = socialMediaLinks.every(link =>
                typeof link === 'object' && link !== null &&
                typeof link.platform === 'string' && link.platform.trim() !== '' &&
                typeof link.url === 'string' && link.url.trim() !== '' &&
                typeof link.iconClass === 'string' && link.iconClass.trim() !== ''
            );
            if (!isValidSocialMediaLinks) {
                return res.status(400).json({ message: 'Each socialMediaLink must have non-empty platform, url, and iconClass (strings).' });
            }
            updatedFields.socialMediaLinks = socialMediaLinks.map(link => ({
                platform: String(link.platform).trim(),
                url: String(link.url).trim(),
                iconClass: String(link.iconClass).trim()
            }));
        }

        // Handle deliveryFees update
        if (deliveryFees !== undefined) {
            if (!Array.isArray(deliveryFees)) {
                return res.status(400).json({ message: 'deliveryFees must be an array.' });
            }
            // Basic validation for deliveryFees array structure
            const isValidDeliveryFees = deliveryFees.every(fee =>
                typeof fee === 'object' && fee !== null &&
                typeof fee.wilayaId === 'number' && fee.wilayaId >= 0 &&
                typeof fee.wilayaName === 'string' && fee.wilayaName.trim() !== '' &&
                typeof fee.price === 'number' && fee.price >= 0
            );
            if (!isValidDeliveryFees) {
                return res.status(400).json({ message: 'Each deliveryFee must have a non-negative wilayaId (number), non-empty wilayaName (string), and non-negative price (number).' });
            }
            // Sort fees by wilayaId to maintain a consistent order if needed
            updatedFields.deliveryFees = deliveryFees.sort((a, b) => a.wilayaId - b.wilayaId);
        }

        // Handle currentDataIndex update
        if (currentDataIndex !== undefined) {
            const parsedIndex = Number(currentDataIndex);
            if (isNaN(parsedIndex) || parsedIndex < 0) {
                return res.status(400).json({ message: 'currentDataIndex must be a non-negative number.' });
            }
            updatedFields.currentDataIndex = parsedIndex;
        }

        // Check if any fields were actually provided for update
        if (Object.keys(updatedFields).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        // Update the singleton document
        Object.assign(config, updatedFields); // Assign updated fields to the fetched config document
        await config.save(); // Save the updated document

        res.status(200).json({ message: 'Site configuration updated successfully!', config });
    } catch (error) {
        console.error('Error updating site configuration:', error.message);
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error updating site configuration. Please try again.', error: error.message });
    }
};


/**
 * @desc Update only the currentDataIndex field of site configuration
 * @route PUT /api/site-config/index
 * @access Private (e.g., Admin only - requires authentication/authorization)
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.updateCurrentDataIndex = async (req, res) => {
    try {
        let config = await SiteConfig.getSingleton();
        const { currentDataIndex } = req.body;

        if (currentDataIndex === undefined) {
            return res.status(400).json({ message: 'currentDataIndex is required.' });
        }

        const parsedIndex = Number(currentDataIndex);
        if (isNaN(parsedIndex) || parsedIndex < 0) {
            return res.status(400).json({ message: 'currentDataIndex must be a non-negative number.' });
        }

        config.currentDataIndex = parsedIndex;
        await config.save();
        res.status(200).json({ message: 'Current data index updated successfully!', config: { currentDataIndex: config.currentDataIndex } });
    } catch (error) {
        console.error('Error updating current data index:', error.message);
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error updating current data index. Please try again.', error: error.message });
    }
};
