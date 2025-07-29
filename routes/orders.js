// routes/orderRoutes.js

// Required Modules
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); // Import Mongoose
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables from .env file

const router = express.Router();

// Import Mongoose Models (ensure these paths are correct relative to your project structure)
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Middleware to extract client ID from JWT token
// This middleware is now more robust and handles cases where no token is provided.
const authenticateClient = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            // Verify the token using JWT_SECRET from environment variables
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mouadsecret');
            req.client = { clientId: decoded.id }; // Attach client ID to the request object
        } catch (err) {
            // If token is invalid or expired, send 401 Unauthorized
            // It's important to stop execution here if the token is bad.
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
    }
    // Proceed to the next middleware or route handler
    next();
};

// POST: Create a new order
router.post('/', async (req, res) => {
    try {
        const { fullName, phoneNumber, wilaya, commune, products, status, notes } = req.body;

        // Basic validation for required fields
        if (!fullName || !phoneNumber || !wilaya || !commune || !products || products.length === 0) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        // Validate Algerian phone number format
        const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({ message: 'Invalid Algerian phone number format.' });
        }

        // Iterate through products to validate and update stock
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

            // Decrease product quantity in stock
            product.quantity -= quantity;
            await product.save();
        }

        // Calculate totalOrdersCount based on the number of distinct products
        const totalOrdersCount = products.length;

        // Create a new Order instance
        const newOrder = new Order({
            fullName,
            phoneNumber,
            wilaya,
            commune,
            products,
            totalOrdersCount,
            status: status || 'pending',
            notes: notes || ''
        });

        await newOrder.save();
        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (error) {
        console.error('Create order error:', error);
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

        if (!orders.length) return res.status(404).json({ message: 'No orders found.' });

        // Format the output to include full image URLs
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
            } : null).filter(p => p !== null), // Filter out any null products
            confirmedBy: order.confirmedBy ? {
                _id: order.confirmedBy._id,
                name: order.confirmedBy.name,
                email: order.confirmedBy.email
            } : null,
            assignedTo: order.assignedTo ? {
                _id: order.assignedTo._id,
                name: order.assignedTo.name,
                email: order.assignedTo.email
            } : null
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
            confirmedBy: order.confirmedBy ? {
                _id: order.confirmedBy._id,
                name: order.confirmedBy.name,
                email: order.confirmedBy.email
            } : null,
            assignedTo: order.assignedTo ? {
                _id: order.assignedTo._id,
                name: order.assignedTo.name,
                email: order.assignedTo.email
            } : null
        };

        res.status(200).json(formattedOrder);
    } catch (error) {
        console.error('Fetch order error:', error);
        // Handle CastError specifically for invalid ObjectId formats
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format.' });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// PATCH: Unified endpoint to update any part of an order.
// This single route replaces the two separate PATCH routes.
router.patch('/:orderId', authenticateClient, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { fullName, phoneNumber, wilaya, commune, notes, assignedTo, status } = req.body;
        const updateFields = {};

        // Conditionally add fields to updateFields if they are provided
        if (fullName !== undefined) updateFields.fullName = fullName;
        if (wilaya !== undefined) updateFields.wilaya = wilaya;
        if (commune !== undefined) updateFields.commune = commune;
        if (notes !== undefined) updateFields.notes = notes;

        // Handle phone number update with validation
        if (phoneNumber !== undefined) {
            const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({ message: 'Invalid phone number format.' });
            }
            updateFields.phoneNumber = phoneNumber;
        }
        
        // Handle status update
        if (status) {
            const allowedStatuses = ['pending', 'confirmed', 'tentative', 'cancelled'];
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
            }
            updateFields.status = status;

            // If status is 'confirmed', set confirmedBy to the authenticated user.
            if (status === 'confirmed') {
                if (!req.client || !req.client.clientId) {
                    return res.status(401).json({ message: 'Authentication required to confirm an order.' });
                }
                updateFields.confirmedBy = req.client.clientId;
            } else {
                // If status is changed to anything other than 'confirmed', clear who confirmed it.
                updateFields.confirmedBy = null;
            }
        }

        // Handle user assignment with validation
        if (assignedTo !== undefined) {
            // If assignedTo is null or an empty string, un-assign the user.
            if (assignedTo === null || assignedTo === '') {
                updateFields.assignedTo = null;
            } else {
                // **FIX**: Check if 'assignedTo' is a valid MongoDB ObjectId before querying.
                if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
                    return res.status(400).json({ message: 'Invalid user ID format for assignment.' });
                }
                const user = await User.findById(assignedTo);
                if (!user) {
                    return res.status(404).json({ message: 'Assigned user not found.' });
                }
                updateFields.assignedTo = assignedTo;
            }
        }

        // Check if there's anything to update
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        // Find and update the order
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { $set: updateFields },
            { new: true, runValidators: true }
        )
        .populate('products.productId')
        .populate('confirmedBy', 'name email')
        .populate('assignedTo', 'name email');

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json({ message: 'Order updated successfully', order: updatedOrder });

    } catch (error) {
        console.error('Update order error:', error);
        // Handle CastError specifically for invalid ObjectId formats
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format.' });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// DELETE: Remove order and restore stock
router.delete('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) return res.status(404).json({ message: 'Order not found.' });

        // Before deleting, return product quantities to stock
        for (const item of order.products) {
            // Use $inc to safely increment the product quantity
            await Product.findByIdAndUpdate(item.productId, { $inc: { quantity: item.quantity } });
        }

        await Order.findByIdAndDelete(orderId);
        res.status(200).json({ message: 'Order deleted successfully and stock restored.' });
    } catch (error) {
        console.error('Delete order error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format.' });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Export the router
module.exports = router;
