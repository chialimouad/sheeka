const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo'); // Assuming this model exists
const Collection = require('../models/Collection'); // Assuming this model exists
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// =========================
// 📦 Multer Setup
// =========================

// ✅ Cloudinary Config
cloudinary.config({
  cloud_name: 'di1u2ssnm',
  api_key: '382166879473993',
  api_secret: 'R4mh6IC2ilC88VKiTFPyyxtBeFU',
});

// ✅ Multer + Cloudinary Storage Setup
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sheeka_products', // Folder in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, crop: 'limit' }],
  },
});

const upload = multer({ storage });
exports.upload = upload;
exports.uploadPromo = upload;

// =========================
// 📸 Promo Image Handlers
// =========================
// Example getProductImagesOnly
// controllers/productController.js
exports.getProductImagesOnly = async (req, res) => {
    try {
        console.log('Backend: Attempting to fetch promo images...');
        const promos = await PromoImage.find({}, 'images');
        console.log('Backend: Fetched raw promos:', JSON.stringify(promos, null, 2)); // Log the raw data

        // Ensure images are indeed arrays and filter out invalid entries before flatMap
        const allImages = promos.flatMap(p => {
            if (p && Array.isArray(p.images)) {
                // Filter out any non-string or empty string entries within the array
                return p.images.filter(img => typeof img === 'string' && img.trim() !== '');
            }
            return []; // Return an empty array if 'images' is not an array or is null/undefined
        });

        console.log('Backend: Processed allImages:', JSON.stringify(allImages)); // Log the final list of images

        if (allImages.length === 0) {
            console.log('Backend: No promo images found, sending empty array.');
            return res.json([]); // Explicitly send an empty array if no images
        }

        res.json(allImages);
        console.log('Backend: Successfully sent promo images.');

    } catch (error) {
        console.error('❌ Backend: Error fetching promo images:', error);
        // Improve error response: Send 500 for server errors, log detailed error
        res.status(500).json({ message: 'Internal Server Error fetching promo images', error: error.message });
    }
};



// ✅ Exemple: Upload promo images
exports.uploadPromoImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const images = req.files.map(file => file.path); // Cloudinary gives you full URLs
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

        // Extract public ID from the Cloudinary URL.
        // Example URL: https://res.cloudinary.com/di1u2ssnm/image/upload/v12345/sheeka_products/image_abcd123.jpg
        // We need 'sheeka_products/image_abcd123' as publicId for deletion.
        const publicIdMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.\w{3,4})?$/);
        let publicId = '';
        if (publicIdMatch && publicIdMatch[1]) {
            // publicIdMatch[1] would be 'sheeka_products/image_abcd123.jpg'
            const fullPathWithExt = publicIdMatch[1];
            // Remove the file extension to get the public_id expected by Cloudinary's destroy method
            publicId = fullPathWithExt.replace(/\.\w{3,4}$/, '');
            if (publicId === '') { // Fallback if no extension was found or regex failed
                publicId = fullPathWithExt;
            }
        }
        
        if (!publicId) {
            return res.status(400).json({ message: 'Could not extract Cloudinary public ID from image URL' });
        }

        // Delete from Cloudinary
        const cloudinaryResult = await cloudinary.uploader.destroy(publicId);

        if (cloudinaryResult.result !== 'ok') {
            console.warn(`⚠️ Cloudinary deletion failed for ${publicId}:`, cloudinaryResult);
            // Even if Cloudinary deletion fails, we'll try to update the DB
        } else {
            console.log(`🗑️ Deleted image from Cloudinary: ${publicId}`);
        }

        // Remove the image path from any PromoImage documents
        const dbResult = await PromoImage.updateMany({}, { $pull: { images: imageUrl } });
        // Delete any PromoImage documents that now have no images
        await PromoImage.deleteMany({ images: { $size: 0 } });

        res.json({ message: '✅ Image deleted', dbResult, cloudinaryResult });
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
        // When using Cloudinary, `file.path` already contains the full URL
        const images = req.files.map(file => file.path);

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
        // Images from Cloudinary are already full URLs, no need to prepend base URL
        res.json(products);
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

        // Images from Cloudinary are already full URLs, no need to prepend base URL
        res.json(product);
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

        // Delete associated image files from Cloudinary
        if (product.images && product.images.length > 0) {
            for (const imageUrl of product.images) {
                const publicIdMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.\w{3,4})?$/);
                let publicId = '';
                if (publicIdMatch && publicIdMatch[1]) {
                    const fullPathWithExt = publicIdMatch[1];
                    publicId = fullPathWithExt.replace(/\.\w{3,4}$/, '');
                    if (publicId === '') {
                        publicId = fullPathWithExt;
                    }
                }

                if (publicId) {
                    try {
                        const cloudinaryResult = await cloudinary.uploader.destroy(publicId);
                        if (cloudinaryResult.result === 'ok') {
                            console.log(`🗑️ Deleted image from Cloudinary: ${publicId}`);
                        } else {
                            console.warn(`⚠️ Cloudinary deletion failed for ${publicId}:`, cloudinaryResult);
                        }
                    } catch (cloudinaryError) {
                        console.error(`❌ Error deleting image from Cloudinary ${publicId}:`, cloudinaryError);
                    }
                } else {
                    console.warn(`⚠️ Could not extract public ID for image: ${imageUrl}`);
                }
            }
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
        console.log('Fetching collections...'); // Add logging
        const collections = await Collection.find()
            .populate({
                path: 'productIds',
                select: 'name images price', // Select specific fields from populated products
            })
            .lean(); // Use .lean() for faster execution if you don't need Mongoose document methods

        console.log('Collections fetched from DB (before processing):', collections.length); // Log fetched count

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
                                console.warn(`⚠️ Invalid product data found in collection ID: ${collection._id}, product index: ${i}`);
                            }
                            return isValid;
                        })
                        .map(product => {
                            const images = Array.isArray(product.images)
                                ? product.images.filter(img => typeof img === 'string' && img.trim() !== '') // Filter out non-string or empty image paths
                                : []; // Default to empty array if images is not an array

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
                console.error(`❌ Error processing collection at index ${i} (ID: ${collection._id}):`, err);
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

        console.log('Collections sent to client:', updatedCollections.length); // Log final count
        res.json(updatedCollections);
    } catch (error) {
        console.error('❌ Error fetching collections:', error);
        res.status(500).json({
            message: 'Error fetching collections',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined // Provide stack only in dev
        });
    }
};

exports.getCollectionById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid collection ID format' });
        }

        const collection = await Collection.findById(id)
            .populate({
                path: 'productIds',
                select: 'name description images price variants quantity', // Select all relevant product fields
            })
            .lean();

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Filter out any invalid or null products after population
        collection.productIds = collection.productIds.filter(product => product && product._id);

        res.json(collection);
    } catch (error) {
        console.error('Error fetching collection by ID:', error);
        res.status(500).json({ message: 'Error fetching collection details', error: error.message });
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
