/**
 * FILE: ./controllers/productController.js
 * DESC: Controller for all product, collection, and promo image logic.
 *
 * FIX:
 * - Added `asyncHandler` to wrap async functions, ensuring errors are passed to Express error handlers.
 * - Added `getPublicProducts` function to create a public API endpoint for storefronts to fetch products.
 * - Added `getPublicCollections` function to create a public API endpoint for storefronts to fetch collections.
 * - Centralized all exports into a single `module.exports` block for clarity and consistency.
 */

const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');
const Collection = require('../models/Collection');
const Client = require('../models/Client');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { body, param, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');

// =========================
// 📦 Dynamic Multer & Cloudinary Setup
// =========================
const uploadMiddleware = async (req, res, next) => {
    try {
        const tenantIdentifier = req.user ? req.user.tenantId : req.tenantId;

        if (!tenantIdentifier) {
            return res.status(400).json({ message: 'Could not identify the tenant for the upload.' });
        }

        const client = await Client.findOne({ tenantId: tenantIdentifier }).lean();

        if (!client || !client.config || !client.config.cloudinary || !client.config.cloudinary.cloud_name) {
            console.error('Cloudinary configuration missing or incomplete for tenant:', tenantIdentifier);
            return res.status(500).json({ message: 'Cloudinary is not configured for this client.' });
        }
        
        const tenantCloudinaryConfig = client.config.cloudinary;
        
        cloudinary.config(tenantCloudinaryConfig);

        const storage = new CloudinaryStorage({
            cloudinary: cloudinary,
            params: {
                folder: `tenant_${tenantIdentifier}/products`,
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                transformation: [{ width: 1024, crop: 'limit' }],
            },
        });

        const upload = multer({ storage }).array('images', 10);
        
        upload(req, res, (err) => {
            if (err) {
                console.error('Multer upload error for tenant ' + tenantIdentifier, err);
                return res.status(400).json({ message: 'Image upload failed.', error: err.message });
            }
            req.client = client; 
            req.tenantId = tenantIdentifier;
            next();
        });
    } catch (error) {
        console.error('Error in uploadMiddleware:', error);
        res.status(500).json({ message: 'Server error during upload setup.' });
    }
};


// **HELPER FUNCTION TO GET TENANT OBJECT ID**
const getTenantObjectId = async (req, res) => {
    const tenantIdentifier = req.user ? req.user.tenantId : req.tenantId;
    
    if (!tenantIdentifier) {
        if (!res.headersSent) res.status(400).json({ message: 'Tenant identifier not found in request.' });
        return null;
    }
    
    if (req.client && req.client.tenantId == tenantIdentifier) {
        return req.client._id;
    }

    const client = await Client.findOne({ tenantId: tenantIdentifier }).lean();
    if (!client) {
        if (!res.headersSent) res.status(404).json({ message: 'Client not found for the provided tenant ID.' });
        return null;
    }
    req.client = client;
    return client._id;
};


// =========================
// 📸 Promo Image Handlers
// =========================

const getProductImagesOnly = asyncHandler(async (req, res) => {
    const tenantObjectId = await getTenantObjectId(req, res);
    if (!tenantObjectId) return;

    const promos = await PromoImage.find({ tenantId: tenantObjectId }, 'images').lean();
    const allImages = promos.flatMap(p => p.images || []);
    res.json(allImages);
});

const uploadPromoImages = asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
    }
    const tenantObjectId = await getTenantObjectId(req, res);
    if (!tenantObjectId) return;

    const images = req.files.map(file => file.path);
    const newPromo = new PromoImage({ images, tenantId: tenantObjectId });
    await newPromo.save();
    res.status(201).json(newPromo);
});


// =========================
// 🏢 Product Handlers
// =========================

const addProduct = [
    body('name').trim().notEmpty().withMessage('Product name is required.'),
    body('description').trim().notEmpty().withMessage('Description is required.'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const { name, description, quantity, price, olprice, variants } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'At least one image is required.' });
        }
        
        let parsedVariants = [];
        if (variants) {
            try {
                parsedVariants = JSON.parse(variants);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid format for variants. Must be a valid JSON string.' });
            }
        }

        const newProduct = new Product({
            tenantId: tenantObjectId,
            name,
            description,
            quantity,
            price,
            olprice,
            images: req.files.map(file => file.path),
            variants: parsedVariants,
        });

        await newProduct.save();
        res.status(201).json(newProduct);
    })
];

const getProducts = asyncHandler(async (req, res) => {
    const tenantObjectId = await getTenantObjectId(req, res);
    if (!tenantObjectId) return;

    const products = await Product.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean();
    res.json(products);
});

// NEW: Public function for storefront
const getPublicProducts = asyncHandler(async (req, res) => {
    const tenantObjectId = await getTenantObjectId(req, res);
    if (!tenantObjectId) return;

    const lang = req.query.lang || 'en';
    const products = await Product.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean();

    const translatedProducts = products.map(product => {
        if (lang !== 'en' && product.translations && product.translations[lang]) {
            const translatedProduct = { ...product };
            translatedProduct.name = product.translations[lang].name || product.name;
            translatedProduct.description = product.translations[lang].description || product.description;
            return translatedProduct;
        }
        return product;
    });

    res.json(translatedProducts);
});


const getProductById = [
    param('id').isMongoId(),
    asyncHandler(async (req, res) => {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const product = await Product.findOne({ _id: req.params.id, tenantId: tenantObjectId }).lean();
        if (!product) {
            return res.status(404).json({ error: 'Product not found.' });
        }
        res.json(product);
    })
];

const updateProduct = [
    param('id').isMongoId(),
    asyncHandler(async (req, res) => {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const product = await Product.findOne({ _id: req.params.id, tenantId: tenantObjectId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found for this client.' });
        }

        const { name, description, quantity, price, olprice, variants } = req.body;
        if (name) product.name = name;
        if (description) product.description = description;
        if (quantity) product.quantity = quantity;
        if (price) product.price = price;
        if (olprice) product.olprice = olprice;
        
        if (variants) {
            try {
                product.variants = JSON.parse(variants);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid format for variants. Must be a valid JSON string.' });
            }
        }

        const newImageUrls = req.files ? req.files.map(file => file.path) : [];
        if (newImageUrls.length > 0) {
            product.images = [...product.images, ...newImageUrls];
        }

        const updatedProduct = await product.save();
        res.json({ message: 'Product updated successfully', product: updatedProduct });
    })
];

const deleteProduct = [
    param('id').isMongoId(),
    asyncHandler(async (req, res) => {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const product = await Product.findOneAndDelete({ _id: req.params.id, tenantId: tenantObjectId });

        if (!product) {
            return res.status(404).json({ error: 'Product not found for this client.' });
        }

        if (product.images && product.images.length > 0) {
            if (!req.client || !req.client.config || !req.client.config.cloudinary) {
                req.client = await Client.findById(tenantObjectId).lean();
            }
            
            if (req.client && req.client.config && req.client.config.cloudinary) {
                cloudinary.config(req.client.config.cloudinary);
                const publicIds = product.images.map(url => {
                    const match = url.match(/(?:v\d+\/)?(tenant_\d+\/.+?)(?:\.\w{3,4})?$/);
                    return match ? match[1] : null;
                }).filter(Boolean);

                if (publicIds.length > 0) {
                    await cloudinary.api.delete_resources(publicIds);
                }
            }
        }

        res.json({ message: 'Product deleted successfully' });
    })
];

// =========================
// 🛒 Collection Handlers
// =========================

const addCollection = [
    body('name').trim().notEmpty(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const { name, thumbnailUrl, productIds } = req.body;
        const newCollection = new Collection({
            name,
            thumbnailUrl,
            productIds: productIds || [],
            tenantId: tenantObjectId
        });
        await newCollection.save();
        res.status(201).json(newCollection);
    })
];

const getCollections = asyncHandler(async (req, res) => {
    const tenantObjectId = await getTenantObjectId(req, res);
    if (!tenantObjectId) return;

    const collections = await Collection.find({ tenantId: tenantObjectId })
        .populate({ path: 'productIds', select: 'name images price' })
        .lean();
    res.json(collections);
});

// NEW: Public function for storefront
const getPublicCollections = asyncHandler(async (req, res) => {
    const tenantObjectId = await getTenantObjectId(req, res);
    if (!tenantObjectId) return;

    const lang = req.query.lang || 'en';
    const collections = await Collection.find({ tenantId: tenantObjectId }).lean();

    if (!collections) {
        return res.status(404).json({ message: 'No collections found for this store.' });
    }

    const translatedCollections = collections.map(collection => {
        if (lang !== 'en' && collection.translations && collection.translations[lang]) {
            const translatedCollection = { ...collection };
            translatedCollection.name = collection.translations[lang].name || collection.name;
            return translatedCollection;
        }
        return collection;
    });

    res.status(200).json(translatedCollections);
});


const updateCollection = [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('productIds').optional().isArray(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const { name, thumbnailUrl, productIds } = req.body;

        const collection = await Collection.findOneAndUpdate(
            { _id: req.params.id, tenantId: tenantObjectId },
            { $set: { name, thumbnailUrl, productIds } },
            { new: true, runValidators: true }
        );

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found.' });
        }
        
        res.json({ message: 'Collection updated successfully', collection });
    })
];

const deleteCollection = [
    param('id').isMongoId(),
    asyncHandler(async (req, res) => {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;
        
        const collection = await Collection.findOneAndDelete({ _id: req.params.id, tenantId: tenantObjectId });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found.' });
        }

        res.json({ message: 'Collection deleted successfully.' });
    })
];


// =========================
// ⭐ Product Review Handlers
// =========================

const createProductReview = [
    param('id').isMongoId(),
    body('rating').isFloat({ min: 1, max: 5 }),
    body('comment').trim().notEmpty(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const customer = req.customer;
        if (!customer) {
            return res.status(401).json({ message: 'Not authorized. Please log in as a customer.' });
        }
        
        const tenantObjectId = customer.tenantId;
        if (!tenantObjectId) {
             return res.status(400).json({ message: 'Customer is not associated with a tenant.' });
        }

        const product = await Product.findOne({ _id: req.params.id, tenantId: tenantObjectId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const alreadyReviewed = product.reviews.find(r => r.customer.toString() === customer.id.toString());
        if (alreadyReviewed) {
            return res.status(400).json({ message: 'You have already reviewed this product.' });
        }

        const { rating, comment } = req.body;
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
    })
];

// Centralized exports
module.exports = {
    uploadMiddleware,
    getProductImagesOnly,
    uploadPromoImages,
    addProduct,
    getProducts,
    getPublicProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    addCollection,
    getCollections,
    getPublicCollections,
    updateCollection,
    deleteCollection,
    createProductReview
};
