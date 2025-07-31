// controllers/productController.js

const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo'); // Assumes this model now has a tenantId field
const Collection = require('../models/Collection'); // Assumes this model now has a tenantId field
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { body, param, query, validationResult } = require('express-validator');

// =========================
// 📦 Dynamic Multer & Cloudinary Setup
// =========================

/**
 * @function uploadMiddleware
 * @description Dynamically configures Multer and Cloudinary for file uploads based on the current tenant's credentials.
 */
exports.uploadMiddleware = (req, res, next) => {
    // req.client is attached by the `identifyTenant` middleware
    if (!req.client || !req.client.config || !req.client.config.cloudinary) {
        return res.status(500).json({ message: 'Cloudinary is not configured for this client.' });
    }

    const tenantCloudinaryConfig = req.client.config.cloudinary;

    // Create a new Cloudinary instance specifically for this tenant
    const cloudinaryInstance = new cloudinary.config(tenantCloudinaryConfig);

    const storage = new CloudinaryStorage({
        cloudinary: cloudinaryInstance,
        params: {
            folder: `tenant_${req.tenantId}/products`, // Isolate uploads into tenant-specific folders
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            transformation: [{ width: 1024, crop: 'limit' }],
        },
    });

    const upload = multer({ storage }).array('images', 10);

    upload(req, res, (err) => {
        if (err) {
            console.error('Multer upload error for tenant ' + req.tenantId, err);
            return res.status(400).json({ message: 'Image upload failed.', error: err.message });
        }
        next();
    });
};

// =========================
// 📸 Promo Image Handlers (Tenant-Aware)
// =========================

exports.getProductImagesOnly = async (req, res) => {
    try {
        // Fetch only images belonging to the current tenant
        const promos = await PromoImage.find({ tenantId: req.tenantId }, 'images').lean();
        const allImages = promos.flatMap(p => p.images || []);
        res.json(allImages);
    } catch (error) {
        console.error('Error fetching promo images:', error);
        res.status(500).json({ message: 'Server error fetching promo images.' });
    }
};

exports.uploadPromoImages = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
    }
    try {
        const images = req.files.map(file => file.path);
        // Create the promo image record for the current tenant
        const newPromo = new PromoImage({ images, tenantId: req.user.tenantId });
        await newPromo.save();
        res.status(201).json(newPromo);
    } catch (error) {
        console.error('Error uploading promo images:', error);
        res.status(500).json({ message: 'Server error uploading promo images.' });
    }
};


// =========================
// 🏢 Product Handlers (Tenant-Aware)
// =========================

exports.addProduct = [
    body('name').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('quantity').isInt({ min: 0 }),
    body('price').isFloat({ min: 0 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { name, description, quantity, price, olprice, variants } = req.body;
            const tenantId = req.user.tenantId; // From 'protect' middleware

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'At least one image is required.' });
            }

            const newProduct = new Product({
                tenantId,
                name,
                description,
                quantity,
                price,
                olprice,
                images: req.files.map(file => file.path),
                variants: variants ? JSON.parse(variants) : [],
            });

            await newProduct.save();
            res.status(201).json(newProduct);
        } catch (error) {
            console.error('Error adding product:', error);
            res.status(500).json({ message: 'Server error while adding product.' });
        }
    }
];

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).lean();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error fetching products.' });
    }
};

exports.getProductById = [
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const product = await Product.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
            if (!product) {
                return res.status(404).json({ error: 'Product not found.' });
            }
            res.json(product);
        } catch (error) {
            console.error('getProductById failed:', error);
            res.status(500).json({ message: 'Server error.' });
        }
    }
];

exports.updateProduct = [
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const tenantId = req.user.tenantId;
            const product = await Product.findOne({ _id: req.params.id, tenantId });

            if (!product) {
                return res.status(404).json({ message: 'Product not found for this client.' });
            }

            // Update text fields
            const { name, description, quantity, price, olprice, variants } = req.body;
            if (name) product.name = name;
            if (description) product.description = description;
            if (quantity) product.quantity = quantity;
            if (price) product.price = price;
            if (olprice) product.olprice = olprice;
            if (variants) product.variants = JSON.parse(variants);

            // Handle image updates
            const newImageUrls = req.files ? req.files.map(file => file.path) : [];
            product.images = [...product.images, ...newImageUrls]; // Add new images

            const updatedProduct = await product.save();
            res.json({ message: 'Product updated successfully', product: updatedProduct });
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({ message: 'Server error while updating product.' });
        }
    }
];

exports.deleteProduct = [
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const tenantId = req.user.tenantId;
            const product = await Product.findOneAndDelete({ _id: req.params.id, tenantId });

            if (!product) {
                return res.status(404).json({ error: 'Product not found for this client.' });
            }

            if (product.images && product.images.length > 0) {
                const cloudinaryInstance = new cloudinary.config(req.client.config.cloudinary);
                const publicIds = product.images.map(url => {
                    const match = url.match(/\/v\d+\/(.+?)(?:\.\w{3,4})?$/);
                    return match ? match[1] : null;
                }).filter(Boolean);

                if (publicIds.length > 0) {
                    await cloudinaryInstance.api.delete_resources(publicIds);
                }
            }

            res.json({ message: 'Product deleted successfully' });
        } catch (error) {
            console.error('Error deleting product:', error);
            res.status(500).json({ message: 'Server error while deleting product.' });
        }
    }
];

// =========================
// 🛒 Collection Handlers (Tenant-Aware)
// =========================

exports.addCollection = [
    body('name').trim().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { name, thumbnailUrl, productIds } = req.body;
            const newCollection = new Collection({
                name,
                thumbnailUrl,
                productIds: productIds || [],
                tenantId: req.user.tenantId // Scope to the current tenant
            });
            await newCollection.save();
            res.status(201).json(newCollection);
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ error: 'A collection with this name already exists for this client.' });
            }
            console.error('Error adding collection:', error);
            res.status(500).json({ message: 'Server error adding collection.' });
        }
    }
];

exports.getCollections = async (req, res) => {
    try {
        const collections = await Collection.find({ tenantId: req.tenantId })
            .populate({ path: 'productIds', select: 'name images price' })
            .lean();
        res.json(collections);
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ message: 'Server error fetching collections.' });
    }
};

// =========================
// ⭐ Product Review Handlers (Tenant-Aware & Secure)
// =========================

exports.createProductReview = [
    param('id').isMongoId(),
    body('rating').isFloat({ min: 1, max: 5 }),
    body('comment').trim().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { rating, comment } = req.body;
            const customer = req.customer; // Should be attached by a customer-specific auth middleware
            
            if (!customer) {
                return res.status(401).json({ message: 'Not authorized. Please log in as a customer.' });
            }

            const product = await Product.findOne({ _id: req.params.id, tenantId: customer.tenantId });

            if (!product) {
                return res.status(404).json({ message: 'Product not found.' });
            }

            const alreadyReviewed = product.reviews.find(r => r.customer.toString() === customer.id.toString());
            if (alreadyReviewed) {
                return res.status(400).json({ message: 'You have already reviewed this product.' });
            }

            const review = {
                name: customer.name,
                rating: Number(rating),
                comment,
                customer: customer.id,
            };

            product.reviews.push(review);
            product.numReviews = product.reviews.length;
            product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

            await product.save();
            res.status(201).json({ message: 'Review added successfully.' });

        } catch (error) {
            console.error('Error creating product review:', error);
            res.status(500).json({ message: 'Server error creating review.' });
        }
    }
];
