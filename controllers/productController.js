const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');
const Collection = require('../models/Collection');
const multer = require('multer');
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { body, param, query, validationResult } = require('express-validator');
// NOTE: You would typically have an authentication middleware to protect routes.
// const { protect } = require('../middleware/authMiddleware'); 

// =========================
// 📦 Multer & Cloudinary Setup
// =========================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'di1u2ssnm',
    api_key: process.env.CLOUDINARY_API_KEY || '382166879473993',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'R4mh6IC2ilC88VKiTFPyyxtBeFU',
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'sheeka_products',
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
// This section is unchanged
exports.getProductImagesOnly = async (req, res, next) => {
    try {
        const promos = await PromoImage.find({}, 'images').lean();
        const allImages = promos.flatMap(p => (p && Array.isArray(p.images) ? p.images.filter(img => typeof img === 'string' && img.trim() !== '') : []));
        res.json(allImages);
    } catch (error) {
        console.error('❌ Backend: Error fetching promo images:', error);
        next(error);
    }
};

exports.uploadPromoImages = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }
        const images = req.files.map(file => file.path);
        const newPromo = new PromoImage({ images });
        await newPromo.save();
        res.status(201).json(newPromo);
    } catch (error) {
        console.error('❌ Backend: Error uploading promo images:', error);
        next(error);
    }
};

exports.deletePromoImage = [
    query('url').isURL().withMessage('Image URL must be a valid URL.').notEmpty().withMessage('Image URL is required.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const imageUrl = req.query.url;
            const publicIdMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.\w{3,4})?$/);
            let publicId = '';
            if (publicIdMatch && publicIdMatch[1]) {
                publicId = publicIdMatch[1].replace(/\.\w{3,4}$/, '');
            }
            if (!publicId) {
                return res.status(400).json({ message: 'Could not extract Cloudinary public ID from image URL.' });
            }
            let cloudinaryResult = { result: 'not_attempted' };
            try {
                cloudinaryResult = await cloudinary.uploader.destroy(publicId);
            } catch (cloudinaryError) {
                console.error(`❌ Error calling Cloudinary API for ${publicId}:`, cloudinaryError);
            }
            const dbResult = await PromoImage.updateMany({}, { $pull: { images: imageUrl } });
            await PromoImage.deleteMany({ images: { $size: 0 } });
            res.json({ message: '✅ Image deletion process completed.', dbResult, cloudinaryResult });
        } catch (error) {
            console.error('Server error during promo image deletion:', error);
            next(error);
        }
    }
];

// =========================
// 🏢 Product Handlers
// =========================

exports.addProduct = [
    // Validation middleware
    body('name').trim().notEmpty().withMessage('Product name is required.'),
    body('description').trim().notEmpty().withMessage('Product description is required.'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('olprice').optional().isFloat({ min: 0 }).withMessage('Original price must be a non-negative number.'),
    body('promocode').optional().trim().escape(),
    body('variants').optional().isJSON().withMessage('Variants must be a valid JSON array string.'),
    
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            // Destructure all expected fields from the request body
            const { name, description, quantity, price, olprice, promocode, variants, product_type, custom_option } = req.body;
            
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'At least one image is required for a product.' });
            }
            
            const images = req.files.map(file => file.path);
            const parsedVariants = variants ? JSON.parse(variants) : [];
            
            const newProduct = new Product({
                name,
                description,
                quantity,
                price,
                olprice,
                promocode,
                images,
                variants: parsedVariants,
                product_type,
                custom_option
            });
            
            await newProduct.save();
            res.status(201).json(newProduct);
        } catch (error) {
            console.error('Error adding product:', error);
            next(error);
        }
    }
];

exports.getProducts = async (req, res, next) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }).lean();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        next(error);
    }
};

exports.getProductById = [
    param('id').isMongoId().withMessage('Invalid Product ID format.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const product = await Product.findById(req.params.id).populate('reviews.user', 'name').lean();
            if (!product) {
                return res.status(404).json({ error: 'Product not found.' });
            }
            res.json(product);
        } catch (error) {
            console.error('❌ getProductById failed:', error);
            next(error);
        }
    }
];

exports.updateProduct = [
    upload.array('images'),
    param('id').isMongoId().withMessage('Invalid Product ID format.'),
    body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty.'),
    body('description').optional().trim().notEmpty().withMessage('Product description cannot be empty.'),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('olprice').optional().isFloat({ min: 0 }).withMessage('Original price must be a non-negative number.'),
    body('promocode').optional().trim().escape(),

    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const product = await Product.findById(req.params.id);
            if (!product) {
                return res.status(404).json({ message: 'Product not found.' });
            }
            
            let imagesToKeep = product.images;
            if (req.body.imagesToKeep) {
                try {
                    imagesToKeep = (typeof req.body.imagesToKeep === 'string') 
                        ? JSON.parse(req.body.imagesToKeep) 
                        : req.body.imagesToKeep;
                } catch (e) {
                    return res.status(400).json({ message: 'Invalid format for imagesToKeep.' });
                }
            }
            
            const newImageUrls = req.files ? req.files.map(file => file.path) : [];
            const imagesToDelete = product.images.filter(url => !imagesToKeep.includes(url));

            for (const imageUrl of imagesToDelete) {
                const publicIdMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.\w{3,4})?$/);
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = publicIdMatch[1].replace(/\.\w{3,4}$/, '');
                    try {
                        await cloudinary.uploader.destroy(publicId);
                    } catch (cloudinaryError) {
                        console.error(`Failed to delete image from Cloudinary ${publicId}:`, cloudinaryError);
                    }
                }
            }
            product.images = [...imagesToKeep, ...newImageUrls];

            const { name, description, quantity, price, olprice, promocode, variants } = req.body;
            if (name !== undefined) product.name = name;
            if (description !== undefined) product.description = description;
            if (quantity !== undefined) product.quantity = quantity;
            if (price !== undefined) product.price = price;
            if (olprice !== undefined) product.olprice = olprice;
            if (promocode !== undefined) product.promocode = promocode;

            if (variants !== undefined) {
                try {
                    const parsedVariants = (typeof variants === 'string') 
                        ? JSON.parse(variants) 
                        : variants;

                    if (!Array.isArray(parsedVariants)) {
                        throw new Error('Variants data is not an array.');
                    }
                    
                    const cleanedVariants = parsedVariants.map(v => {
                        const { _id, ...rest } = v;
                        return rest;
                    });
                    product.variants = cleanedVariants;
                } catch (e) {
                    return res.status(400).json({ message: `Invalid variants format: ${e.message}` });
                }
            }

            const updatedProduct = await product.save();
            res.json({ message: 'Product updated successfully', product: updatedProduct });

        } catch (error) {
            console.error('Error updating product:', error);
            next(error);
        }
    }
];

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
            if (product.images && product.images.length > 0) {
                for (const imageUrl of product.images) {
                    const publicIdMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.\w{3,4})?$/);
                    if (publicIdMatch && publicIdMatch[1]) {
                        const publicId = publicIdMatch[1].replace(/\.\w{3,4}$/, '');
                        try {
                            await cloudinary.uploader.destroy(publicId);
                        } catch (cloudinaryError) {
                            console.error(`❌ Error deleting image from Cloudinary ${publicId}:`, cloudinaryError);
                        }
                    }
                }
            }
            res.json({ message: 'Product deleted successfully' });
        } catch (error) {
            console.error('Error deleting product:', error);
            next(error);
        }
    }
];

exports.createProductReview = [
    // protect, 
    param('id').isMongoId().withMessage('Invalid Product ID format.'),
    body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be a number between 1 and 5.'),
    body('comment').trim().notEmpty().withMessage('Comment cannot be empty.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { rating, comment } = req.body;
            const product = await Product.findById(req.params.id);

            if (!product) {
                return res.status(404).json({ message: 'Product not found' });
            }

            if (!req.user) {
                 return res.status(401).json({ message: 'Not authorized, no token' });
            }
            const alreadyReviewed = product.reviews.find(
                (r) => r.user.toString() === req.user._id.toString()
            );

            if (alreadyReviewed) {
                return res.status(400).json({ message: 'Product already reviewed' });
            }

            const review = {
                name: req.user.name,
                rating: Number(rating),
                comment,
                user: req.user._id,
            };

            product.reviews.push(review);

            product.numReviews = product.reviews.length;
            product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

            await product.save();
            res.status(201).json({ message: 'Review added successfully' });

        } catch (error) {
            console.error('Error creating product review:', error);
            next(error);
        }
    }
];

// ** NEW ** Handler for fetching product reviews
exports.getProductReviews = [
    param('id').isMongoId().withMessage('Invalid Product ID format.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const product = await Product.findById(req.params.id).select('reviews').populate('reviews.user', 'name');
            
            if (!product) {
                return res.status(404).json({ message: 'Product not found' });
            }

            res.json(product.reviews);

        } catch (error) {
            console.error('Error fetching product reviews:', error);
            next(error);
        }
    }
];


// =========================
// 🛒 Collection Handlers
// =========================
exports.getCollections = async (req, res, next) => {
    try {
        const collections = await Collection.find().populate({ path: 'productIds', select: 'name images price' }).lean();
        const updatedCollections = collections.map(collection => {
            const populatedProducts = (collection.productIds || []).filter(p => p && p.name && p.price !== undefined && Array.isArray(p.images));
            return { ...collection, productIds: populatedProducts };
        });
        res.json(updatedCollections);
    } catch (error) {
        console.error('❌ Error fetching collections:', error);
        next(error);
    }
};

exports.getCollectionById = [
    param('id').isMongoId().withMessage('Invalid collection ID format.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { id } = req.params;
            const collection = await Collection.findById(id).populate({ path: 'productIds', select: 'name description images price variants quantity' }).lean();
            if (!collection) {
                return res.status(404).json({ message: 'Collection not found.' });
            }
            collection.productIds = (collection.productIds || []).filter(p => p && p._id);
            res.json(collection);
        } catch (error) {
            console.error('Error fetching collection by ID:', error);
            next(error);
        }
    }
];

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
            const newCollection = new Collection({ name, thumbnailUrl, productIds: productIds || [] });
            await newCollection.save();
            res.status(201).json(newCollection);
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ error: 'Collection with this name already exists.' });
            }
            next(error);
        }
    }
];

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
            if (productIds !== undefined) updatedFields.productIds = productIds;
            if (Object.keys(updatedFields).length === 0) {
                return res.status(400).json({ message: 'No fields provided for update.' });
            }
            const collection = await Collection.findByIdAndUpdate(req.params.id, updatedFields, { new: true, runValidators: true }).lean();
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found.' });
            }
            res.json({ message: 'Collection updated successfully', collection });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ error: 'Collection with this name already exists.' });
            }
            next(error);
        }
    }
];

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
            next(error);
        }
    }
];
