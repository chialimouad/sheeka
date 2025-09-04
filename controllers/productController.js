/**
 * FILE: ./controllers/productController.js
 * DESC: Controller for all product, collection, and promo image logic.
 *
 * REFACTOR:
 * - Replaced Cloudinary with local file storage.
 * - Removed `cloudinary` and `multer-storage-cloudinary` dependencies.
 * - Created a new `uploadMiddleware` using `multer.diskStorage` to save
 * files directly to the server's filesystem.
 * - Files are organized into tenant-specific subdirectories (e.g., 'public/uploads/tenant_subdomain/').
 * - Updated `deleteProduct` to remove image files from the local filesystem
 * using `fs.unlink`.
 * - Image URLs are now relative paths to be served statically by Express.
 *
 * FIX (based on logs):
 * - Introduced a new `identifyTenant` middleware to ensure tenant identification
 * runs on ALL product-related routes, not just file uploads. This resolves
 * the 400 "Tenant could not be identified" error on GET requests.
 * - Simplified the `uploadMiddleware` to rely on the `identifyTenant` middleware
 * running first.
 * - Removed the redundant `getTenantObjectId` helper function.
 * - Refactored all handlers to use `req.client._id` directly, which is now
 * reliably populated by the `identifyTenant` middleware.
 */

const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');
const Collection = require('../models/Collection');
const Client = require('../models/Client');
const multer = require('multer');
const { body, param, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

// Define UPLOADS_DIR at the top for consistent use
const UPLOADS_DIR = process.env.RENDER_DISK_MOUNT_PATH || path.resolve('public/uploads');

// =========================
// 🏢 Tenant Identification Middleware
// =========================
// This middleware should be applied to all product/collection routes
// to ensure the tenant is identified before any other logic runs.
const identifyTenant = async (req, res, next) => {
    try {
        const identifier = req.user?.tenantId || req.headers['x-tenant-id'];
        
        if (!identifier && identifier !== 0) {
            // Correctly send a 400 error if the header is missing.
            return res.status(400).json({ message: 'Tenant could not be identified. The "x-tenant-id" header is missing.' });
        }

        let query;
        const isNumeric = !isNaN(parseFloat(identifier)) && isFinite(identifier);

        if (isNumeric) {
            query = { tenantId: Number(identifier) };
        } else {
            query = { subdomain: String(identifier).toLowerCase() };
        }

        const client = await Client.findOne(query).lean();
        
        if (!client) {
            return res.status(404).json({ message: 'Tenant not found.' });
        }

        // Attach tenant info to the request for use in subsequent handlers
        req.client = client;
        req.tenantId = client.tenantId; // For backward compatibility if needed
        next();
    } catch (error) {
        console.error("Error during tenant identification:", error);
        res.status(500).json({ message: 'Server error during tenant identification.' });
    }
};


// =========================
// 📦 Local File Storage Setup with Multer
// =========================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // The `identifyTenant` middleware has already run, so `req.client` is available.
        if (!req.client || !req.client.subdomain) {
            return cb(new Error('Tenant has not been identified prior to upload.'), null);
        }
        const uploadDir = path.join(UPLOADS_DIR, req.client.subdomain);
        fs.mkdirSync(uploadDir, { recursive: true }); // Create directory if it doesn't exist
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Create a unique filename to prevent overwriting
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
    }
});

const uploadMiddleware = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
    fileFilter: (req, file, cb) => {
        // Allow only common image types
        const allowedTypes = /jpeg|jpg|png|webp/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: File upload only supports the following filetypes - ' + allowedTypes));
    }
}).array('images', 10);


// =========================
// 📸 Promo Image Handlers
// =========================

const getProductImagesOnly = async (req, res) => {
    try {
        const tenantObjectId = req.client._id;
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
        const tenantObjectId = req.client._id;
        
        const images = req.files.map(file => {
            const relativePath = path.join('/uploads', req.client.subdomain, file.filename);
            return relativePath.replace(/\\/g, '/');
        });

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
            
            const tenantObjectId = req.client._id;
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

            const imagesForDb = req.files.map(file => {
                const relativePath = path.join('/uploads', req.client.subdomain, file.filename);
                return {
                    url: relativePath.replace(/\\/g, '/'),
                    public_id: file.filename 
                };
            });

            const newProduct = new Product({
                tenantId: tenantObjectId,
                name,
                description,
                quantity,
                price,
                olprice,
                barcode,
                images: imagesForDb,
                variants: formattedVariants,
            });

            await newProduct.save();
            res.status(201).json(newProduct);
        } catch (error) {
            if (error.code === 11000 && error.keyPattern && error.keyPattern.barcode) {
                return res.status(409).json({ message: 'A product with this barcode already exists for this tenant.' });
            }
            console.error('Error adding product:', error);
            res.status(500).json({ message: 'Server error while adding product.' });
        }
    }
];

const getProducts = async (req, res) => {
    try {
        const tenantObjectId = req.client._id;
        const products = await Product.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error fetching products.' });
    }
};

const getPublicProducts = async (req, res) => {
    try {
        const tenantObjectId = req.client._id;
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
            const tenantObjectId = req.client._id;
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
            const tenantObjectId = req.client._id;
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
            const tenantObjectId = req.client._id;
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
                const newImages = req.files.map(file => {
                    const relativePath = path.join('/uploads', req.client.subdomain, file.filename);
                    return {
                        url: relativePath.replace(/\\/g, '/'),
                        public_id: file.filename
                    };
                });
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
            const tenantObjectId = req.client._id;
            const product = await Product.findOneAndDelete({ _id: req.params.id, tenantId: tenantObjectId });

            if (!product) {
                return res.status(404).json({ error: 'Product not found for this client.' });
            }

            if (product.images && product.images.length > 0) {
                const tenantSubdomain = req.client.subdomain;
                product.images.forEach(image => {
                    if (image.public_id) {
                        // FIX: Use the absolute path defined at the top of the file
                        const imagePath = path.join(UPLOADS_DIR, tenantSubdomain, image.public_id);
                        fs.unlink(imagePath, (err) => {
                            if (err) {
                                console.error(`Failed to delete image file: ${imagePath}`, err);
                            } else {
                                console.log(`Successfully deleted image file: ${imagePath}`);
                            }
                        });
                    }
                });
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
            
            const tenantObjectId = req.client._id;
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
        const tenantObjectId = req.client._id;
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
        const tenantObjectId = req.client._id;
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
            
            const tenantObjectId = req.client._id;
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
            const tenantObjectId = req.client._id;
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
            
            // Assuming customer object has tenantId attached during login
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
    identifyTenant, // Export the new middleware
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
