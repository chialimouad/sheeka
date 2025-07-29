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
            req.client = { clientId: decoded.id };
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
        const { fullName, phoneNumber, wilaya, commune, address, products, status, notes } = req.body;

        if (!fullName || !phoneNumber || !wilaya || !commune || !products || products.length === 0) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({ message: 'Invalid Algerian phone number format.' });
        }

        for (const item of products) {
            const { productId, quantity, color, size } = item;
            if (!productId || !quantity || !color || !size) {
                return res.status(400).json({ message: 'Each product must include ID, quantity, color, and size.' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(400).json({ message: `Product with ID ${productId} not found.` });
            }
            if (product.quantity < quantity) {
                return res.status(400).json({ message: `Insufficient stock for product: ${product.name}. Available: ${product.quantity}, Requested: ${quantity}` });
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
            notes: notes || ''
        });

        // The pre-save hook in Order.js will automatically set the 'pending' timestamp
        await newOrder.save();
        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET: Count of all orders
router.get('/count', async (req, res) => {
    try {
        // Efficiently count the documents without fetching them all
        const count = await Order.countDocuments();
        res.status(200).json({ count });
    } catch (error) {
        console.error('Count orders error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET: Single order by ID
router.get('/:orderId', async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('products.productId')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!order) return res.status(404).json({ message: 'Order not found.' });

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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// PATCH: Update order status and notes
router.patch('/:orderId/status', authenticateClient, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, notes } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        let hasUpdate = false;

        if (status) {
            const allowedStatuses = ['pending', 'confirmed', 'tentative', 'cancelled', 'dispatched', 'delivered', 'returned'];
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ message: 'Invalid status. Allowed: ' + allowedStatuses.join(', ') });
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
                    return res.status(401).json({ message: 'Unauthorized. Agent must be logged in to confirm order.' });
                }
                order.confirmedBy = req.client.clientId;
            }
        }

        if (notes !== undefined) {
            order.notes = notes;
            hasUpdate = true;
        }

        if (!hasUpdate) {
            return res.status(400).json({ message: 'No fields provided to update status or notes.' });
        }

        const savedOrder = await order.save();

        // Populate the fields for the response
        const populatedOrder = await savedOrder.populate([
            { path: 'products.productId' },
            { path: 'confirmedBy', select: 'name email' },
            { path: 'assignedTo', select: 'name email' }
        ]);

        res.status(200).json({ message: 'Order status updated successfully', order: populatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// PATCH: General order update
router.patch('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { fullName, phoneNumber, wilaya, commune, address, notes, assignedTo } = req.body;
        const updateFields = {};

        if (fullName !== undefined) updateFields.fullName = fullName;
        if (phoneNumber !== undefined) {
            const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({ message: 'Invalid phone number format.' });
            }
            updateFields.phoneNumber = phoneNumber;
        }
        if (wilaya !== undefined) updateFields.wilaya = wilaya;
        if (commune !== undefined) updateFields.commune = commune;
        if (address !== undefined) updateFields.address = address;
        if (notes !== undefined) updateFields.notes = notes;

        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                updateFields.assignedTo = null;
            } else {
                const user = await User.findById(assignedTo);
                if (!user) {
                    return res.status(400).json({ message: 'Assigned user not found.' });
                }
                updateFields.assignedTo = assignedTo;
            }
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { $set: updateFields },
            { new: true, runValidators: true }
        )
        .populate('products.productId')
        .populate('confirmedBy', 'name email')
        .populate('assignedTo', 'name email');

        if (!updatedOrder) return res.status(404).json({ message: 'Order not found.' });
        res.status(200).json({ message: 'Order updated successfully', order: updatedOrder });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// DELETE: Remove order
router.delete('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) return res.status(404).json({ message: 'Order not found.' });

        // Return product quantities to stock before deleting
        for (const item of order.products) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { quantity: item.quantity } });
        }

        await Order.findByIdAndDelete(orderId);
        res.status(200).json({ message: 'Order deleted successfully and stock restored.' });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Export the router
module.exports = router;
