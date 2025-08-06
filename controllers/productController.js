/**
 * FILE: ./controllers/productController.js
 * DESC: Controller for all product, collection, and promo image logic.
 *
 * FIX:
 * - Added a try...catch block within the `getTenantObjectId` helper function.
 * - This prevents unhandled promise rejections if the `Client.findOne` database
 * call fails, which was the likely cause of the 500 Internal Server Error.
 * - Removed the 'express-async-handler' dependency.
 * - Replaced asyncHandler with standard try...catch blocks for error handling.
 * - Refactored `getTenantObjectId` to be more resilient. It now checks for the
 * 'x-tenant-id' header directly as a fallback, fixing the 400 error when the
 * identifyTenant middleware does not populate req.tenantId.
 * - UPDATED: Integrated 'barcode' field into product creation and updates.
 * - UPDATED: Added specific error handling for duplicate barcode entries.
 * - NEW: Added `getProductByBarcode` to fetch a product using its barcode.
 * - FIX: Corrected `getPublicProducts` and `getPublicCollections` to properly use the `getTenantObjectId` helper, resolving the 400 Bad Request error.
 * - UPDATE: Changed tenant lookup logic to use the subdomain from the request header (`x-tenant-id`) instead of the internal numeric `tenantId`. This makes tenant identification more robust and intuitive.
 * - FIX: Resolved `TypeError` by making the `getTenantObjectId` helper handle both numeric `tenantId` (from authenticated users) and string `subdomain` (from public headers).
 * - FIX: Added data transformation in `addProduct` to handle the mismatch between the frontend form's variant structure and the updated backend model, resolving the 'Product validation failed' error.
 */

const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');
const Collection = require('../models/Collection');
const Client = require('../models/Client');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { body, param, validationResult } = require('express-validator');

// =========================
// 📦 Dynamic Multer & Cloudinary Setup
// =========================
const uploadMiddleware = async (req, res, next) => {
    try {
        const tenantIdentifier = req.user ? req.user.tenantId : (req.headers['x-tenant-id'] || req.tenantId);

        if (!tenantIdentifier) {
            return res.status(400).json({ message: 'Could not identify the tenant for the upload.' });
        }

        // Find the client by their unique subdomain or numeric ID
        let query;
        if (typeof tenantIdentifier === 'string' && isNaN(tenantIdentifier)) {
            query = { subdomain: tenantIdentifier.toLowerCase() };
        } else {
            query = { tenantId: Number(tenantIdentifier) };
        }
        const client = await Client.findOne(query).lean();

        if (!client || !client.config || !client.config.cloudinary || !client.config.cloudinary.cloud_name) {
            console.error('Cloudinary configuration missing or incomplete for tenant:', tenantIdentifier);
            return res.status(500).json({ message: 'Cloudinary is not configured for this client.' });
        }
        
        const tenantCloudinaryConfig = client.config.cloudinary;
        
        cloudinary.config(tenantCloudinaryConfig);

        const storage = new CloudinaryStorage({
            cloudinary: cloudinary,
            params: {
                folder: `tenant_${client.subdomain}/products`, // Use subdomain for folder consistency
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                transformation: [{ width: 1024, crop: 'limit' }],
            },
        });

        const upload = multer({ storage }).array('images', 10);
        
        upload(req, res, (err) => {
            if (err) {
                console.error('Multer upload error for tenant ' + client.subdomain, err);
                return res.status(400).json({ message: 'Image upload failed.', error: err.message });
            }
            req.client = client; 
            req.tenantId = client.tenantId;
            next();
        });
    } catch (error) {
        console.error('Error in uploadMiddleware:', error);
        res.status(500).json({ message: 'Server error during upload setup.' });
    }
};


// **HELPER FUNCTION TO GET TENANT OBJECT ID**
// FIX: This function now robustly handles both numeric tenantId and string subdomain.
const getTenantObjectId = async (req) => {
    const identifier = req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
    
    if (!identifier) {
        return null;
    }

    try {
        let client = null;
        let query;

        // If the identifier is a non-numeric string, query by subdomain. This is for public requests.
        if (typeof identifier === 'string' && isNaN(identifier)) {
            const subdomain = identifier.toLowerCase();
            query = { subdomain: subdomain };
            if (req.client && req.client.subdomain === subdomain) {
                return req.client._id;
            }
        } 
        // Otherwise, treat it as a numeric tenantId. This is typical for authenticated users.
        else {
            const numericTenantId = Number(identifier);
            query = { tenantId: numericTenantId };
            if (req.client && req.client.tenantId === numericTenantId) {
                return req.client._id;
            }
        }

        client = await Client.findOne(query).lean();

        if (!client) {
            return null;
        }
        
        req.client = client;
        return client._id;
    } catch (error) {
        console.error("Database error in getTenantObjectId:", error);
        return null;
    }
};


// =========================
// 📸 Promo Image Handlers
// =========================

const getProductImagesOnly = async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req);
        if (!tenantObjectId) {
            return res.status(400).json({ message: 'Tenant could not be identified.' });
        }

        const promos = await PromoImage.find({ tenantId: tenantObjectId }, 'images').lean();
        const allImages = promos.flatMap(p => p.images || []);
        res.json(allImages);
    } catch (error) {
        console.error('Error fetching promo images:', error);
        res.status(500).json({ message: 'Server error fetching promo images.' });
    }
};

const uploadPromoImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }
        const tenantObjectId = await getTenantObjectId(req);
        if (!tenantObjectId) {
            return res.status(400).json({ message: 'Tenant could not be identified.' });
        }

        const images = req.files.map(file => file.path);
        const newPromo = new PromoImage({ images, tenantId: tenantObjectId });
        await newPromo.save();
        res.status(201).json(newPromo);
    } catch (error) {
        console.error('Error uploading promo images:', error);
        res.status(500).json({ message: 'Server error uploading promo images.' });
    }
};


// =========================
// 🏢 Product Handlers
// =========================

const addProduct = [
    body('name').trim().notEmpty().withMessage('Product name is required.'),
    body('description').trim().notEmpty().withMessage('Description is required.'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('barcode').optional().trim().notEmpty().withMessage('Barcode cannot be an empty string.'),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            
            const tenantObjectId = await getTenantObjectId(req);
            if (!tenantObjectId) {
                return res.status(400).json({ message: 'Tenant could not be identified.' });
            }

            const { name, description, quantity, price, olprice, variants, barcode } = req.body;

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

            // ** FIX **: Transform the frontend variant structure to match the backend schema.
            const formattedVariants = [];
            if (Array.isArray(parsedVariants)) {
                parsedVariants.forEach(variant => {
                    if (variant.colors && variant.colors.length > 0) {
                        formattedVariants.push({ name: 'Color', options: variant.colors });
                    }
                    if (variant.sizes && variant.sizes.length > 0) {
                        formattedVariants.push({ name: 'Size', options: variant.sizes });
                    }
                });
            }

            const newProduct = new Product({
                tenantId: tenantObjectId,
                name,
                description,
                quantity,
                price,
                olprice,
                barcode,
                images: req.files.map(file => ({ url: file.path, public_id: file.filename })),
                variants: formattedVariants, // Use the transformed variants
            });

            await newProduct.save();
            res.status(201).json(newProduct);
        } catch (error) {
            if (error.code === 11000 && error.keyPattern && error.keyPattern.barcode) {
                return res.status(409).json({ message: 'A product with this barcode already exists for this tenant.' });
            }
            console.warn('Error adding product:', error); // Use warn to see the validation error object
            res.status(500).json({ message: 'Server error while adding product.' });
        }
    }
];

const getProducts = async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req);
        if (!tenantObjectId) {
            return res.status(400).json({ message: 'Tenant could not be identified.' });
        }

        const products = await Product.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error fetching products.' });
    }
};

const getPublicProducts = async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req);
        if (!tenantObjectId) {
            return res.status(400).json({ message: 'Tenant could not be identified from request.' });
        }

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
    } catch (error) {
        console.error('Error fetching public products:', error);
        res.status(500).json({ message: 'Server error fetching public products.' });
    }
};


const getProductById = [
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const tenantObjectId = await getTenantObjectId(req);
            if (!tenantObjectId) {
                return res.status(400).json({ message: 'Tenant could not be identified.' });
            }

            const product = await Product.findOne({ _id: req.params.id, tenantId: tenantObjectId }).lean();
            if (!product) {
                return res.status(404).json({ error: 'Product not found.' });
            }
            res.json(product);
        } catch (error) {
            console.error('Error fetching product by ID:', error);
            res.status(500).json({ message: 'Server error fetching product by ID.' });
        }
    }
];

const getProductByBarcode = [
    param('barcode').notEmpty().withMessage('Barcode is required.'),
    async (req, res) => {
        try {
            const tenantObjectId = await getTenantObjectId(req);
            if (!tenantObjectId) {
                return res.status(400).json({ message: 'Tenant could not be identified.' });
            }

            const product = await Product.findOne({
                barcode: req.params.barcode,
                tenantId: tenantObjectId
            }).lean();

            if (!product) {
                return res.status(404).json({ message: 'Product with this barcode not found for this tenant.' });
            }
            res.json(product);
        } catch (error) {
            console.error('Error fetching product by barcode:', error);
            res.status(500).json({ message: 'Server error fetching product by barcode.' });
        }
    }
];

const updateProduct = [
    param('id').isMongoId(),
    body('barcode').optional().trim().notEmpty().withMessage('Barcode cannot be an empty string.'),
    async (req, res) => {
        try {
            const tenantObjectId = await getTenantObjectId(req);
            if (!tenantObjectId) {
                return res.status(400).json({ message: 'Tenant could not be identified.' });
            }

            const product = await Product.findOne({ _id: req.params.id, tenantId: tenantObjectId });

            if (!product) {
                return res.status(404).json({ message: 'Product not found for this client.' });
            }

            const { name, description, quantity, price, olprice, variants, barcode } = req.body;
            if (name) product.name = name;
            if (description) product.description = description;
            if (quantity) product.quantity = quantity;
            if (price) product.price = price;
            if (olprice) product.olprice = olprice;
            if (barcode) product.barcode = barcode;
            
            if (variants) {
                try {
                    product.variants = JSON.parse(variants);
                } catch (e) {
                    return res.status(400).json({ message: 'Invalid format for variants. Must be a valid JSON string.' });
                }
            }

            if (req.files && req.files.length > 0) {
                const newImages = req.files.map(file => ({ url: file.path, public_id: file.filename }));
                product.images.push(...newImages);
            }

            const updatedProduct = await product.save();
            res.json({ message: 'Product updated successfully', product: updatedProduct });
        } catch (error) {
            if (error.code === 11000 && error.keyPattern && error.keyPattern.barcode) {
                return res.status(409).json({ message: 'A product with this barcode already exists for this tenant.' });
            }
            console.error('Error updating product:', error);
            res.status(500).json({ message: 'Server error while updating product.' });
        }
    }
];

const deleteProduct = [
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const tenantObjectId = await getTenantObjectId(req);
            if (!tenantObjectId) {
                return res.status(400).json({ message: 'Tenant could not be identified.' });
            }

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
                    const publicIds = product.images.map(image => image.public_id).filter(Boolean);

                    if (publicIds.length > 0) {
                        await cloudinary.api.delete_resources(publicIds);
                    }
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
// 🛒 Collection Handlers
// =========================

const addCollection = [
    body('name').trim().notEmpty(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            
            const tenantObjectId = await getTenantObjectId(req);
            if (!tenantObjectId) {
                return res.status(400).json({ message: 'Tenant could not be identified.' });
            }

            const { name, thumbnailUrl, productIds } = req.body;
            const newCollection = new Collection({
                name,
                thumbnailUrl,
                productIds: productIds || [],
                tenantId: tenantObjectId
            });
            await newCollection.save();
            res.status(201).json(newCollection);
        } catch (error) {
            console.error('Error adding collection:', error);
            res.status(500).json({ message: 'Server error while adding collection.' });
        }
    }
];

const getCollections = async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req);
        if (!tenantObjectId) {
            return res.status(400).json({ message: 'Tenant could not be identified.' });
        }

        const collections = await Collection.find({ tenantId: tenantObjectId })
            .populate({ path: 'productIds', select: 'name images price' })
            .lean();
        res.json(collections);
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ message: 'Server error fetching collections.' });
    }
};

const getPublicCollections = async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req);
        if (!tenantObjectId) {
            return res.status(400).json({ message: 'Tenant could not be identified from request.' });
        }

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
    } catch (error) {
        console.error('Error fetching public collections:', error);
        res.status(500).json({ message: 'Server error fetching public collections.' });
    }
};


const updateCollection = [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('productIds').optional().isArray(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            
            const tenantObjectId = await getTenantObjectId(req);
            if (!tenantObjectId) {
                return res.status(400).json({ message: 'Tenant could not be identified.' });
            }

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
        } catch (error) {
            console.error('Error updating collection:', error);
            res.status(500).json({ message: 'Server error while updating collection.' });
        }
    }
];

const deleteCollection = [
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const tenantObjectId = await getTenantObjectId(req);
            if (!tenantObjectId) {
                return res.status(400).json({ message: 'Tenant could not be identified.' });
            }
            
            const collection = await Collection.findOneAndDelete({ _id: req.params.id, tenantId: tenantObjectId });

            if (!collection) {
                return res.status(404).json({ message: 'Collection not found.' });
            }

            res.json({ message: 'Collection deleted successfully.' });
        } catch (error) {
            console.error('Error deleting collection:', error);
            res.status(500).json({ message: 'Server error while deleting collection.' });
        }
    }
];


// =========================
// ⭐ Product Review Handlers
// =========================

const createProductReview = [
    param('id').isMongoId(),
    body('rating').isFloat({ min: 1, max: 5 }),
    body('comment').trim().notEmpty(),
    async (req, res) => {
        try {
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
        } catch (error) {
            console.error('Error creating product review:', error);
            res.status(500).json({ message: 'Server error creating review.' });
        }
    }
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
    getProductByBarcode,
    updateProduct,
    deleteProduct,
    addCollection,
    getCollections,
    getPublicCollections,
    updateCollection,
    deleteCollection,
    createProductReview
};
