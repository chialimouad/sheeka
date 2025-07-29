// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true,
        match: [/^(\+213|0)(5|6|7)[0-9]{8}$/, 'Invalid Algerian phone number']
    },
    wilaya: {
        type: String,
        required: true
    },
    commune: {
        type: String,
        required: true
    },
    // Address field is optional
    address: {
        type: String,
        required: false
    },
    // This is the field for the custom barcode ID.
    barcodeId: {
        type: String,
        trim: true,
        default: null
    },
    // FIX: Added the missing deliveryFee field to the schema
    deliveryFee: {
        type: Number,
        default: 0
    },
    products: [{
        // Note: For simplicity on the frontend, you might send populated product names.
        // If not, you'll need to adjust the frontend to handle just the ID.
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: {
            type: String
        }, // Denormalizing name for easier display
        quantity: {
            type: Number,
            required: true
        },
        color: {
            type: String,
            required: true
        },
        size: {
            type: String,
            required: true
        }
    }],
    totalOrdersCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'tentative', 'dispatched', 'delivered', 'returned'],
        default: 'pending'
    },
    // This field will store the history of status changes.
    statusTimestamps: {
        type: Map,
        of: Date,
        default: {}
    },
    confirmedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    notes: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Mongoose middleware to automatically set the timestamp for the initial 'pending' status.
// This will run before a new document is saved.
orderSchema.pre('save', function(next) {
    // 'this' refers to the document being saved.
    // isNew is a Mongoose boolean property that is true if the document is new.
    if (this.isNew) {
        // Set the timestamp for the 'pending' status to the current time.
        this.statusTimestamps.set('pending', new Date());
    }
    next(); // Continue with the save operation.
});


const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
```javascript
// routes/orderRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables from .env file

const router = express.Router();

// Import Mongoose Models
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

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

// POST: Create a new order
router.post('/', async (req, res) => {
    try {
        const {
            fullName,
            phoneNumber,
            wilaya,
            commune,
            address,
            products,
            status,
            notes,
            barcodeId,
            deliveryFee // Added deliveryFee
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
            barcodeId: barcodeId || null, // Save the barcodeId if provided
            deliveryFee: deliveryFee || 0 // Save the deliveryFee
        });

        // The pre-save hook in Order.js will automatically set the 'pending' timestamp
        await newOrder.save();
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

// GET: Count of all orders
router.get('/count', async (req, res) => {
    try {
        // Efficiently count the documents without fetching them all
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
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!orders.length) return res.status(200).json([]); // Return empty array instead of 404

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
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

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

            // FIX: Make timestamp update more robust by initializing the Map if it doesn't exist.
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

        const savedOrder = await order.save();

        // Populate the fields for the response
        const populatedOrder = await savedOrder.populate([{
            path: 'products.productId'
        }, {
            path: 'confirmedBy',
            select: 'name email'
        }, {
            path: 'assignedTo',
            select: 'name email'
        }]);

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


// PATCH: General order update (Refactored for consistency and hook execution)
router.patch('/:orderId', authenticateClient, async (req, res) => {
    try {
        const { orderId } = req.params;
        const updates = req.body;

        // Find the order first
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // List of fields that can be updated through this endpoint
        const allowedUpdates = ['fullName', 'phoneNumber', 'wilaya', 'commune', 'address', 'notes', 'assignedTo', 'barcodeId', 'deliveryFee'];

        let isUpdated = false;
        // Iterate over allowed fields and update the order object
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                // Handle unsetting the 'assignedTo' field
                if (key === 'assignedTo' && (updates[key] === '' || updates[key] === null)) {
                    order.assignedTo = null;
                    isUpdated = true;
                    continue; // Move to the next key
                }

                // Handle unsetting the 'barcodeId' field
                if (key === 'barcodeId' && updates[key].trim() === '') {
                    order.barcodeId = null;
                    isUpdated = true;
                    continue; // Move to the next key
                }
                
                // Validate phone number format
                if (key === 'phoneNumber') {
                    const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
                    if (!phoneRegex.test(updates[key])) {
                        return res.status(400).json({ message: 'Invalid phone number format.' });
                    }
                }
                
                // Validate that the assigned user exists
                if (key === 'assignedTo' && updates[key]) {
                     const user = await User.findById(updates[key]);
                     if (!user) {
                         return res.status(400).json({ message: 'Assigned user not found.' });
                     }
                }

                // Apply the update to the order object
                order[key] = updates[key];
                isUpdated = true;
            }
        }

        if (!isUpdated) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        // Save the modified order, which triggers 'save' hooks
        const savedOrder = await order.save();

        // Populate the necessary fields for the response
        const populatedOrder = await savedOrder.populate([
            { path: 'products.productId' },
            { path: 'confirmedBy', select: 'name email' },
            { path: 'assignedTo', select: 'name email' }
        ]);

        res.status(200).json({
            message: 'Order updated successfully',
            order: populatedOrder
        });

    } catch (error) {
        console.error('--- CRITICAL UPDATE ORDER ERROR ---:', error);
        // Handle potential validation errors from Mongoose
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation Error', error: error.message });
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

        // Return product quantities to stock before deleting
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

// Export the router
module.exports = router;
