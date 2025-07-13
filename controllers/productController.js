const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');
const Collection = require('../models/Collection');
const multer = require('multer');
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { body, param, query, validationResult } = require('express-validator'); // Import express-validator

// =========================
// 📦 Multer Setup
// =========================

// IMPORTANT: Use environment variables for sensitive credentials!
// For example, in your .env file:
// CLOUDINARY_CLOUD_NAME=your_cloud_na
// CLOUDINARY_API_KEY=your_api_key
// CLOUDINARY_API_SECRET=your_api_secret
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
        transformation: [{ width: 800, crop: 'limit' }],
    },
});

const upload = multer({ storage });
exports.upload = upload;
exports.uploadPromo = upload; // Reusing the same upload instance for promo images

// =========================
// 📸 Promo Image Handlers
// =========================

/**
 * @desc Get all promo images
 * @route GET /api/promo/images
 * @access Public
 */
exports.getProductImagesOnly = async (req, res, next) => {
    try {
        console.log('Backend: Attempting to fetch promo images...');
        const promos = await PromoImage.find({}, 'images').lean(); // Use .lean() for faster queries if not modifying documents
        console.log('Backend: Fetched raw promos:', JSON.stringify(promos, null, 2));

        const allImages = promos.flatMap(p => {
            // Ensure p and p.images exist and p.images is an array
            if (p && Array.isArray(p.images)) {
                // Filter out any non-string or empty string entries within the array
                return p.images.filter(img => typeof img === 'string' && img.trim() !== '');
            }
            return []; // Return an empty array if 'images' is not an array or is null/undefined
        });

        console.log('Backend: Processed allImages:', JSON.stringify(allImages));

        if (allImages.length === 0) {
            console.log('Backend: No promo images found, sending empty array.');
            return res.json([]); // Explicitly send an empty array if no images
        }

        res.json(allImages);
        console.log('Backend: Successfully sent promo images.');
    } catch (error) {
        console.error('❌ Backend: Error fetching promo images:', error);
        next(error); // Pass error to centralized error handler
    }
};

/**
 * @desc Upload promo images
 * @route POST /api/promo/upload
 * @access Private (e.g., Admin)
 * @validation Requires `req.files` to be present.
 */
exports.uploadPromoImages = async (req, res, next) => {
    // Check for validation errors from express-validator (if any were applied before this handler)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        const images = req.files.map(file => file.path); // Cloudinary provides full URLs
        const newPromo = new PromoImage({ images });
        await newPromo.save();
        res.status(201).json(newPromo);
    } catch (error) {
        console.error('❌ Backend: Error uploading promo images:', error);
        next(error); // Pass error to centralized error handler
    }
};

/**
 * @desc Delete a promo image
 * @route DELETE /api/promo/delete?url=<imageUrl>
 * @access Private (e.g., Admin)
 * @validation Requires 'url' query parameter.
 */
exports.deletePromoImage = [
    query('url').isURL().withMessage('Image URL must be a valid URL.').notEmpty().withMessage('Image URL is required.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const imageUrl = req.query.url;

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
            }

            if (!publicId) {
                return res.status(400).json({ message: 'Could not extract Cloudinary public ID from image URL.' });
            }

            // Delete from Cloudinary
            let cloudinaryResult = { result: 'not_attempted' };
            try {
                cloudinaryResult = await cloudinary.uploader.destroy(publicId);
                if (cloudinaryResult.result === 'ok') {
                    console.log(`🗑️ Deleted image from Cloudinary: ${publicId}`);
                } else {
                    console.warn(`⚠️ Cloudinary deletion failed for ${publicId}:`, cloudinaryResult);
                }
            } catch (cloudinaryError) {
                console.error(`❌ Error calling Cloudinary API for ${publicId}:`, cloudinaryError);
                // Continue to update DB even if Cloudinary deletion fails
            }

            // Remove the image path from any PromoImage documents
            const dbResult = await PromoImage.updateMany({}, { $pull: { images: imageUrl } });
            // Delete any PromoImage documents that now have no images
            await PromoImage.deleteMany({ images: { $size: 0 } });

            res.json({ message: '✅ Image deletion process completed.', dbResult, cloudinaryResult });
        } catch (error) {
            console.error('Server error during promo image deletion:', error);
            next(error); // Pass error to centralized error handler
        }
    }
];


// =========================
// 🏢 Product Handlers
// =========================

/**
 * @desc Add a new product
 * @route POST /api/products
 * @access Private (e.g., Admin)
 * @validation Validates name, description, quantity, price, and variants.
 */
exports.addProduct = [
    body('name').trim().notEmpty().withMessage('Product name is required.'),
    body('description').trim().notEmpty().withMessage('Product description is required.'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('variants')
        .optional()
        .custom((value, { req }) => {
            try {
                // Attempt to parse the variants string
                const parsed = JSON.parse(value);
                if (!Array.isArray(parsed)) {
                    throw new Error('Variants must be a JSON array.');
                }
                // Optionally, add more specific validation for each variant object structure here
                // e.g., parsed.every(v => v.color && v.size && typeof v.stock === 'number')
                return true;
            } catch (e) {
                throw new Error('Invalid variants format: Must be a valid JSON array string.');
            }
        }),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { name, description, quantity, price, variants } = req.body;

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'At least one image is required for a product.' });
            }
            const images = req.files.map(file => file.path); // Cloudinary gives you full URLs

            let parsedVariants = [];
            if (variants) {
                parsedVariants = JSON.parse(variants); // Already validated by custom validator
            }

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
            next(error); // Pass error to centralized error handler
        }
    }
];

/**
 * @desc Get all products
 * @route GET /api/products
 * @access Public
 */
exports.getProducts = async (req, res, next) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }).lean(); // Use .lean()
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        next(error); // Pass error to centralized error handler
    }
};

/**
 * @desc Get product by ID
 * @route GET /api/products/:id
 * @access Public
 * @validation Validates ID format.
 */
exports.getProductById = [
    param('id').isMongoId().withMessage('Invalid Product ID format.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        console.log('📥 getProductById called with id:', req.params.id);

        try {
            const product = await Product.findById(req.params.id).lean(); // Use .lean()
            if (!product) {
                return res.status(404).json({ error: 'Product not found.' });
            }
            res.json(product);
        } catch (error) {
            console.error('❌ getProductById failed:', error);
            next(error); // Pass error to centralized error handler
        }
    }
];

/**
 * @desc Update a product
 * @route PUT /api/products/:id
 * @access Private (e.g., Admin)
 * @validation Validates ID format and optional fields.
 */
exports.updateProduct = [
    param('id').isMongoId().withMessage('Invalid Product ID format.'),
    body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty.'),
    body('description').optional().trim().notEmpty().withMessage('Product description cannot be empty.'),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('images').optional().isArray().withMessage('Images must be an array of URLs.')
        .custom(images => images.every(img => typeof img === 'string' && img.trim() !== '')).withMessage('Each image must be a non-empty string URL.'),
    body('variants')
        .optional()
        .custom((value, { req }) => {
            try {
                const parsed = JSON.parse(value);
                if (!Array.isArray(parsed)) {
                    throw new Error('Variants must be a JSON array.');
                }
                return true;
            } catch (e) {
                throw new Error('Invalid variants format: Must be a valid JSON array string.');
            }
        }),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { name, description, quantity, price, images, variants } = req.body;

            const updatedFields = {};
            if (name !== undefined) updatedFields.name = name;
            if (description !== undefined) updatedFields.description = description;
            if (quantity !== undefined) updatedFields.quantity = quantity;
            if (price !== undefined) updatedFields.price = price;
            if (images !== undefined) updatedFields.images = images; // Assumes client sends full array of image URLs
            if (variants !== undefined) updatedFields.variants = JSON.parse(variants); // Already validated

            if (Object.keys(updatedFields).length === 0) {
                return res.status(400).json({ message: 'No fields provided for update.' });
            }

            const product = await Product.findByIdAndUpdate(req.params.id, updatedFields, { new: true, runValidators: true }).lean();

            if (!product) {
                return res.status(404).json({ error: 'Product not found.' });
            }

            res.json({ message: 'Product updated successfully', product });
        } catch (error) {
            console.error('Error updating product:', error);
            next(error); // Pass error to centralized error handler
        }
    }
];

/**
 * @desc Delete a product
 * @route DELETE /api/products/:id
 * @access Private (e.g., Admin)
 * @validation Validates ID format.
 */
exports.deleteProduct = [
    param('id').isMongoId().withMessage('Invalid Product ID format.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const product = await Product.findByIdAndDelete(req.params.id);
            if (!product) {
                return res.status(404).json({ error: 'Product not found.' });
            }

            // Delete associated image files from Cloudinary
            if (product.images && product.images.length > 0) {
                for (const imageUrl of product.images) {
                    const publicIdMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.\w{3,4})?$/);
                    let publicId = '';
                    if (publicIdMatch && publicIdMatch[1]) {
                        publicId = publicIdMatch[1].replace(/\.\w{3,4}$/, '');
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
                            // Log the error but don't block the product deletion success
                        }
                    } else {
                        console.warn(`⚠️ Could not extract public ID for image: ${imageUrl}`);
                    }
                }
            }
            res.json({ message: 'Product deleted successfully' });
        } catch (error) {
            console.error('Error deleting product:', error);
            next(error); // Pass error to centralized error handler
        }
    }
];

// =========================
// 🛒 Collection Handlers
// =========================

/**
 * @desc Get all collections with populated products
 * @route GET /api/collections
 * @access Public
 */
exports.getCollections = async (req, res, next) => {
    try {
        console.log('Fetching collections...');
        const collections = await Collection.find()
            .populate({
                path: 'productIds',
                select: 'name images price', // Select specific fields from populated products
            })
            .lean(); // Use .lean() for faster execution if you don't need Mongoose document methods

        console.log('Collections fetched from DB (before processing):', collections.length);

        const updatedCollections = collections.map((collection, i) => {
            try {
                const populatedProducts = Array.isArray(collection.productIds)
                    ? collection.productIds
                        .filter(product => {
                            const isValid = product && typeof product === 'object' &&
                                product.name && product.price !== undefined && Array.isArray(product.images);
                            if (!isValid) {
                                console.warn(`⚠️ Invalid product data found in collection ID: ${collection._id}, product index: ${i}`);
                            }
                            return isValid;
                        })
                        .map(product => {
                            const images = Array.isArray(product.images)
                                ? product.images.filter(img => typeof img === 'string' && img.trim() !== '')
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
                    thumbnailUrl: typeof collection.thumbnailUrl === 'string' && collection.thumbnailUrl.trim() !== ''
                        ? collection.thumbnailUrl
                        : 'https://placehold.co/150x150/EEEEEE/333333?text=No+Image',
                    productIds: populatedProducts,
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt,
                };
            } catch (err) {
                console.error(`❌ Error processing collection at index ${i} (ID: ${collection._id}):`, err);
                return {
                    _id: collection._id,
                    name: collection.name || 'Unknown Collection',
                    thumbnailUrl: 'https://placehold.co/150x150/EEEEEE/333333?text=Error',
                    productIds: [],
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt,
                    error: 'Error processing collection data on server'
                };
            }
        });

        console.log('Collections sent to client:', updatedCollections.length);
        res.json(updatedCollections);
    } catch (error) {
        console.error('❌ Error fetching collections:', error);
        next(error); // Pass error to centralized error handler
    }
};

/**
 * @desc Get collection by ID with populated products
 * @route GET /api/collections/:id
 * @access Public
 * @validation Validates ID format.
 */
exports.getCollectionById = [
    param('id').isMongoId().withMessage('Invalid collection ID format.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { id } = req.params;
            const collection = await Collection.findById(id)
                .populate({
                    path: 'productIds',
                    select: 'name description images price variants quantity',
                })
                .lean();

            if (!collection) {
                return res.status(404).json({ message: 'Collection not found.' });
            }

            collection.productIds = collection.productIds.filter(product => product && product._id);

            res.json(collection);
        } catch (error) {
            console.error('Error fetching collection by ID:', error);
            next(error); // Pass error to centralized error handler
        }
    }
];

/**
 * @desc Add a new collection
 * @route POST /api/collections
 * @access Private (e.g., Admin)
 * @validation Validates name, optional thumbnailUrl, and productIds.
 */
exports.addCollection = [
    body('name').trim().notEmpty().withMessage('Collection name is required.'),
    body('thumbnailUrl').optional().isURL().withMessage('Thumbnail URL must be a valid URL.'),
    body('productIds').optional().isArray().withMessage('Product IDs must be an array.')
        .custom(ids => ids.every(id => mongoose.Types.ObjectId.isValid(id))).withMessage('Each product ID must be a valid MongoDB Object ID.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { name, thumbnailUrl, productIds } = req.body;

            const newCollection = new Collection({
                name,
                thumbnailUrl: thumbnailUrl || 'https://placehold.co/150x150/EEEEEE/333333?text=No+Image',
                productIds: productIds || [],
            });

            await newCollection.save();
            res.status(201).json(newCollection);
        } catch (error) {
            console.error('Error adding collection:', error);
            if (error.code === 11000) { // Duplicate key error
                return res.status(409).json({ error: 'Collection with this name already exists.' });
            }
            next(error); // Pass other errors to centralized error handler
        }
    }
];

/**
 * @desc Update a collection
 * @route PUT /api/collections/:id
 * @access Private (e.g., Admin)
 * @validation Validates ID format and optional fields.
 */
exports.updateCollection = [
    param('id').isMongoId().withMessage('Invalid Collection ID format.'),
    body('name').optional().trim().notEmpty().withMessage('Collection name cannot be empty.'),
    body('thumbnailUrl').optional().isURL().withMessage('Thumbnail URL must be a valid URL.'),
    body('productIds').optional().isArray().withMessage('Product IDs must be an array.')
        .custom(ids => ids.every(id => mongoose.Types.ObjectId.isValid(id))).withMessage('Each product ID must be a valid MongoDB Object ID.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { name, thumbnailUrl, productIds } = req.body;

            const updatedFields = {};
            if (name !== undefined) updatedFields.name = name;
            if (thumbnailUrl !== undefined) updatedFields.thumbnailUrl = thumbnailUrl;
            if (productIds !== undefined && Array.isArray(productIds)) {
                updatedFields.productIds = productIds; // Already validated
            }

            if (Object.keys(updatedFields).length === 0) {
                return res.status(400).json({ message: 'No fields provided for update.' });
            }

            const collection = await Collection.findByIdAndUpdate(req.params.id, updatedFields, { new: true, runValidators: true }).lean();

            if (!collection) {
                return res.status(404).json({ error: 'Collection not found.' });
            }

            res.json({ message: 'Collection updated successfully', collection });
        } catch (error) {
            console.error('Error updating collection:', error);
            if (error.code === 11000) {
                return res.status(409).json({ error: 'Collection with this name already exists.' });
            }
            next(error); // Pass other errors to centralized error handler
        }
    }
];

/**
 * @desc Delete a collection
 * @route DELETE /api/collections/:id
 * @access Private (e.g., Admin)
 * @validation Validates ID format.
 */
exports.deleteCollection = [
    param('id').isMongoId().withMessage('Invalid Collection ID format.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const collection = await Collection.findByIdAndDelete(req.params.id);
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found.' });
            }
            res.json({ message: 'Collection deleted successfully' });
        } catch (error) {
            console.error('Error deleting collection:', error);
            next(error); // Pass error to centralized error handler
        }
    }
];

