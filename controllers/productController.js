// controllers/productController.js

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
// This middleware dynamically configures multer and Cloudinary for file uploads
// based on the tenant's specific API keys stored in the database.
exports.uploadMiddleware = async (req, res, next) => {
    try {
        // FIX: Use the same logic as getTenantObjectId to correctly identify the tenant.
        // This prioritizes the tenant ID from the authenticated user (`req.user`), which is
        // available after the `protect` middleware runs.
        const tenantIdentifier = req.user ? req.user.tenantId : req.tenantId;

        if (!tenantIdentifier) {
            return res.status(400).json({ message: 'Could not identify the tenant for the upload.' });
        }

        // Fetch the client configuration using the identified tenantId.
        const client = await Client.findOne({ tenantId: tenantIdentifier }).lean();

        if (!client || !client.config || !client.config.cloudinary || !client.config.cloudinary.cloud_name) {
            console.error('Cloudinary configuration missing or incomplete for tenant:', tenantIdentifier);
            return res.status(500).json({ message: 'Cloudinary is not configured for this client.' });
        }
        
        const tenantCloudinaryConfig = client.config.cloudinary;
        
        // Configure the Cloudinary instance with the tenant's credentials.
        cloudinary.config(tenantCloudinaryConfig);

        const storage = new CloudinaryStorage({
            cloudinary: cloudinary,
            params: {
                folder: `tenant_${tenantIdentifier}/products`, // Use the identified tenant ID
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
            // Attach the fetched client and the correct tenantId to the request for other controllers to use.
            req.client = client; 
            req.tenantId = tenantIdentifier; // Ensure req.tenantId is set for subsequent functions
            next();
        });
    } catch (error) {
        console.error('Error in uploadMiddleware:', error);
        res.status(500).json({ message: 'Server error during upload setup.' });
    }
};


// **HELPER FUNCTION TO GET TENANT OBJECT ID**
// This helper centralizes the logic for retrieving the tenant's database _id.
const getTenantObjectId = async (req, res) => {
    // Prioritize the tenantId from an authenticated user session.
    const tenantIdentifier = req.user ? req.user.tenantId : req.tenantId;
    
    if (!tenantIdentifier) {
        if (!res.headersSent) res.status(400).json({ message: 'Tenant identifier not found in request.' });
        return null;
    }
    
    // Reuse the client object if it was already fetched by middleware.
    if (req.client && req.client.tenantId == tenantIdentifier) {
        return req.client._id;
    }

    // Otherwise, fetch the client from the database.
    const client = await Client.findOne({ tenantId: tenantIdentifier }).lean();
    if (!client) {
        if (!res.headersSent) res.status(404).json({ message: 'Client not found for the provided tenant ID.' });
        return null;
    }
    req.client = client; // Attach for potential later use
    return client._id;
};


// =========================
// 📸 Promo Image Handlers
// =========================

exports.getProductImagesOnly = async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const promos = await PromoImage.find({ tenantId: tenantObjectId }, 'images').lean();
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
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

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

exports.addProduct = [
    body('name').trim().notEmpty().withMessage('Product name is required.'),
    body('description').trim().notEmpty().withMessage('Description is required.'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
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
        } catch (error) {
            console.error('Error adding product:', error);
            res.status(500).json({ message: 'Server error while adding product.' });
        }
    }
];

exports.getProducts = async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const products = await Product.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error fetching products.' });
        }
    }
};

exports.getProductById = [
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const tenantObjectId = await getTenantObjectId(req, res);
            if (!tenantObjectId) return;

            const product = await Product.findOne({ _id: req.params.id, tenantId: tenantObjectId }).lean();
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
            const tenantObjectId = await getTenantObjectId(req, res);
            if (!tenantObjectId) return;

            const product = await Product.findOneAndDelete({ _id: req.params.id, tenantId: tenantObjectId });

            if (!product) {
                return res.status(404).json({ error: 'Product not found for this client.' });
            }

            // Important: Ensure client config is loaded for Cloudinary deletion
            if (product.images && product.images.length > 0) {
                if (!req.client || !req.client.config || !req.client.config.cloudinary) {
                    // Fetch client if not already on req object
                    req.client = await Client.findById(tenantObjectId).lean();
                }
                
                if (req.client && req.client.config && req.client.config.cloudinary) {
                    // Re-configure cloudinary for this specific tenant before deleting
                    cloudinary.config(req.client.config.cloudinary);
                    const publicIds = product.images.map(url => {
                        // Improved Regex to extract public_id from various Cloudinary URL formats
                        const match = url.match(/(?:v\d+\/)?(tenant_\d+\/.+?)(?:\.\w{3,4})?$/);
                        return match ? match[1] : null;
                    }).filter(Boolean);

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

exports.addCollection = [
    body('name').trim().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
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
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const collections = await Collection.find({ tenantId: tenantObjectId })
            .populate({ path: 'productIds', select: 'name images price' })
            .lean();
        res.json(collections);
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ message: 'Server error fetching collections.' });
    }
};

exports.updateCollection = [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('productIds').optional().isArray(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
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
        } catch (error) {
            console.error('Error updating collection:', error);
            res.status(500).json({ message: 'Server error updating collection.' });
        }
    }
];

exports.deleteCollection = [
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const tenantObjectId = await getTenantObjectId(req, res);
            if (!tenantObjectId) return;
            
            const collection = await Collection.findOneAndDelete({ _id: req.params.id, tenantId: tenantObjectId });

            if (!collection) {
                return res.status(404).json({ message: 'Collection not found.' });
            }

            res.json({ message: 'Collection deleted successfully.' });
        } catch (error) {
            console.error('Error deleting collection:', error);
            res.status(500).json({ message: 'Server error deleting collection.' });
        }
    }
];


// =========================
// ⭐ Product Review Handlers
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
            // The protectCustomer middleware should have attached the customer object
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
