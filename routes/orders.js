const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config(); // Load environment variables from .env file

// Import Mongoose Models
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// --- NEW: Abandoned Cart Schema and Model ---
// This schema will store the details of carts that were started but not completed.
const abandonedCartSchema = new mongoose.Schema({
    fullName: { type: String, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    wilaya: String,
    commune: String,
    product: {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: String,
        quantity: Number,
        color: String,
        size: String,
        price: Number
    },
    pageUrl: String,
    // The 'createdAt' field includes a TTL (Time To Live) index.
    // Documents in this collection will be automatically deleted from the database after 30 days.
    createdAt: { type: Date, default: Date.now, expires: '30d' } 
});

// To avoid duplicate entries, we create a compound index.
// This ensures that we only store one abandoned cart record per phone number and product ID.
abandonedCartSchema.index({ phoneNumber: 1, 'product.productId': 1 }, { unique: true });

const AbandonedCart = mongoose.model('AbandonedCart', abandonedCartSchema);
// --- End of New Schema ---


const router = express.Router();

// Middleware to extract client ID from JWT token
const authenticateClient = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mouadsecret');
            req.client = {
                clientId: decoded.id
            };
        } catch (err) {
            // If the token is invalid, we don't block the request,
            // but subsequent logic will handle the lack of a client ID.
        }
    }
    next();
};

// --- NEW: Route to handle abandoned cart data ---
router.post('/abandoned', async (req, res) => {
    try {
        const { fullName, phoneNumber, product, pageUrl, wilaya, commune } = req.body;

        // Basic validation to ensure the most critical data is present.
        if (!phoneNumber || !product || !product.productId) {
            return res.status(400).json({ message: 'Phone number and product ID are required.' });
        }

        // We use `findOneAndUpdate` with `upsert: true`.
        // This is a powerful command that means:
        // 1. Find a document matching the `filter`.
        // 2. If it exists, apply the `update`.
        // 3. If it does NOT exist, create a new document using both the filter and update data (upsert).
        // This prevents creating multiple abandoned cart entries for the same person and product.
        const filter = { phoneNumber: phoneNumber, 'product.productId': product.productId };
        const update = {
            $set: {
                fullName: fullName,
                wilaya: wilaya,
                commune: commune,
                product: product,
                pageUrl: pageUrl,
                createdAt: new Date() // We update the timestamp on each interaction.
            }
        };
        const options = { upsert: true, new: true, setDefaultsOnInsert: true };

        const abandonedCart = await AbandonedCart.findOneAndUpdate(filter, update, options);

        res.status(200).json({ message: 'Abandoned cart data saved successfully.', cart: abandonedCart });

    } catch (error) {
        // If the database operation fails (e.g., due to the unique index), we catch the error.
        if (error.code === 11000) {
            // This specific error code means a duplicate key error, which is expected with our logic.
            // We can just confirm that the data is already there.
            return res.status(200).json({ message: 'Cart data already exists.' });
        }
        console.error('Abandoned cart error:', error);
        res.status(500).json({ message: 'Server error while saving abandoned cart.', error: error.message });
    }
});

// --- NEW: Route to get all abandoned carts ---
router.get('/abandoned', async (req, res) => {
    try {
        // This finds all documents in the AbandonedCart collection and sorts them by creation date.
        const carts = await AbandonedCart.find().sort({ createdAt: -1 });
        res.status(200).json(carts);
    } catch (error) {
        console.error('Fetch abandoned carts error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// POST: Create a new order
router.post('/', async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ message: 'Request body is missing or invalid. Ensure `Content-Type` header is set to `application/json`.' });
        }
        const {
            fullName,
            phoneNumber,
            wilaya,
            commune,
            address,
            products,
            status,
            notes,
            barcodeId
        } = req.body;

        if (!fullName || !phoneNumber || !wilaya || !commune || !products || products.length === 0) {
            return res.status(400).json({
                message: 'Missing required fields.'
            });
        }

        const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({
                message: 'Invalid Algerian phone number format.'
            });
        }

        for (const item of products) {
            const {
                productId,
                quantity,
                color,
                size
            } = item;
            if (!productId || !quantity || !color || !size) {
                return res.status(400).json({
                    message: 'Each product must include ID, quantity, color, and size.'
                });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(400).json({
                    message: `Product with ID ${productId} not found.`
                });
            }
            if (product.quantity < quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for product: ${product.name}. Available: ${product.quantity}, Requested: ${quantity}`
                });
            }

            product.quantity -= quantity;
            await product.save();
        }

        const totalOrdersCount = products.length;

        const newOrder = new Order({
            fullName,
            phoneNumber,
            wilaya,
            commune,
            address,
            products,
            totalOrdersCount,
            status: status || 'pending',
            notes: notes || '',
            barcodeId: barcodeId || null
        });

        await newOrder.save();
        
        // After a successful order, we can remove any corresponding abandoned cart record.
        if (products.length > 0) {
            await AbandonedCart.deleteOne({ phoneNumber: phoneNumber, 'product.productId': products[0].productId });
        }


        res.status(201).json({
            message: 'Order created successfully',
            order: newOrder
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});
// GET: Order by Barcode ID
router.get('/barcode/:barcodeId', async (req, res) => {
    try {
        const { barcodeId } = req.params;
        const order = await Order.findOne({ barcodeId: barcodeId })
            .populate('products.productId')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!order) {
            return res.status(404).json({ message: 'Order not found with this barcode.' });
        }

        const formattedOrder = {
            ...order._doc,
            products: order.products.map(p => p.productId ? {
                _id: p.productId._id,
                name: p.productId.name,
                price: p.productId.price,
                images: (p.productId.images || []).map(img => `https://sheeka.onrender.com${img}`),
                quantity: p.quantity,
                color: p.color,
                size: p.size
            } : null).filter(p => p !== null),
            confirmedBy: order.confirmedBy,
            assignedTo: order.assignedTo
        };

        res.status(200).json(formattedOrder);
    } catch (error) {
        console.error('Fetch order by barcode error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});
// GET: Count of all orders
router.get('/count', async (req, res) => {
    try {
        const count = await Order.countDocuments();
        res.status(200).json({
            count
        });
    } catch (error) {
        console.error('Count orders error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

// GET: All orders
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('products.productId')
            .populate('confirmedBy', 'name email');

        if (!orders.length) return res.status(200).json([]);

        const formattedOrders = orders.map(order => ({
            ...order._doc,
            products: order.products.map(p => p.productId ? {
                _id: p.productId._id,
                name: p.productId.name,
                price: p.productId.price,
                images: (p.productId.images || []).map(img => `https://sheeka.onrender.com${img}`),
                quantity: p.quantity,
                color: p.color,
                size: p.size
            } : null).filter(p => p !== null),
            confirmedBy: order.confirmedBy,
            assignedTo: order.assignedTo
        }));

        res.status(200).json(formattedOrders);
    } catch (error) {
        console.error('Fetch orders error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

// GET: Single order by ID
router.get('/:orderId', async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('products.productId')
            .populate('confirmedBy', 'name email');

        if (!order) return res.status(404).json({
            message: 'Order not found.'
        });

        const formattedOrder = {
            ...order._doc,
            products: order.products.map(p => p.productId ? {
                _id: p.productId._id,
                name: p.productId.name,
                price: p.productId.price,
                images: (p.productId.images || []).map(img => `https://sheeka.onrender.com${img}`),
                quantity: p.quantity,
                color: p.color,
                size: p.size
            } : null).filter(p => p !== null),
            confirmedBy: order.confirmedBy,
            assignedTo: order.assignedTo
        };

        res.status(200).json(formattedOrder);
    } catch (error) {
        console.error('Fetch order error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});


// PATCH: Update order status and notes
router.patch('/:orderId/status', authenticateClient, async (req, res) => {
    try {
        const {
            orderId
        } = req.params;
        const {
            status,
            notes
        } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                message: 'Order not found.'
            });
        }

        let hasUpdate = false;

        if (status) {
            const allowedStatuses = ['pending', 'confirmed', 'tentative', 'cancelled', 'dispatched', 'delivered', 'returned'];
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    message: 'Invalid status. Allowed: ' + allowedStatuses.join(', ')
                });
            }
            order.status = status;

            if (!order.statusTimestamps) {
                order.statusTimestamps = new Map();
            }
            order.statusTimestamps.set(status, new Date());
            hasUpdate = true;

            if (status === 'confirmed') {
                if (!req.client || !req.client.clientId) {
                    return res.status(401).json({
                        message: 'Unauthorized. Agent must be logged in to confirm order.'
                    });
                }
                order.confirmedBy = req.client.clientId;
            }
        }

        if (notes !== undefined) {
            order.notes = notes;
            hasUpdate = true;
        }

        if (!hasUpdate) {
            return res.status(400).json({
                message: 'No fields provided to update status or notes.'
            });
        }

        await order.save();

        // Re-fetch and populate for the response
        const populatedOrder = await Order.findById(orderId)
            .populate('products.productId')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email'); 

        res.status(200).json({
            message: 'Order status updated successfully',
            order: populatedOrder
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});


// PATCH: General order update
router.patch('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID format.' });
        }

        if (!req.body) {
            return res.status(400).json({ message: 'Request body is missing or invalid. Ensure `Content-Type` header is set to `application/json`.' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const {
            fullName,
            phoneNumber,
            wilaya,
            commune,
            address,
            notes,
            assignedTo,
            barcodeId
        } = req.body;

        let hasUpdate = false;

        if (fullName !== undefined) {
            order.fullName = fullName;
            hasUpdate = true;
        }
        if (phoneNumber !== undefined) {
            const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({ message: 'Invalid phone number format.' });
            }
            order.phoneNumber = phoneNumber;
            hasUpdate = true;
        }
        if (wilaya !== undefined) {
            order.wilaya = wilaya;
            hasUpdate = true;
        }
        if (commune !== undefined) {
            order.commune = commune;
            hasUpdate = true;
        }
        if (address !== undefined) {
            order.address = address;
            hasUpdate = true;
        }
        if (notes !== undefined) {
            order.notes = notes;
            hasUpdate = true;
        }
        if (barcodeId !== undefined) {
            order.barcodeId = barcodeId;
            hasUpdate = true;
        }

        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                order.assignedTo = null;
            } else {
                if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
                    return res.status(400).json({ message: 'Invalid assigned user ID format.' });
                }
                const user = await User.findById(assignedTo);
                if (!user) {
                    return res.status(400).json({ message: 'Assigned user not found.' });
                }
                order.assignedTo = assignedTo;
            }
            hasUpdate = true;
        }

        if (!hasUpdate) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        const savedOrder = await order.save();

        // **FIX:** Re-fetch the document for the response WITHOUT populating `assignedTo`.
        const updatedOrderForResponse = await Order.findById(savedOrder._id)
            .populate('products.productId')
            .populate('confirmedBy', 'name email');
        // By omitting `.populate('assignedTo', ...)`, the `assignedTo` field in the response
        // will now be the plain ID string you expect.

        res.status(200).json({
            message: 'Order updated successfully',
            order: updatedOrderForResponse
        });

    } catch (error) {
        console.error('Update order error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: `Validation failed: ${messages.join(', ')}` });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ message: `Invalid ID format for field: ${error.path}` });
        }

        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

// DELETE: Remove order
router.delete('/:orderId', async (req, res) => {
    try {
        const {
            orderId
        } = req.params;
        const order = await Order.findById(orderId);

        if (!order) return res.status(404).json({
            message: 'Order not found.'
        });

        for (const item of order.products) {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: {
                    quantity: item.quantity
                }
            });
        }

        await Order.findByIdAndDelete(orderId);
        res.status(200).json({
            message: 'Order deleted successfully and stock restored.'
        });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;
