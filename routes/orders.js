// IMPORTANT: Save this file as 'routes/orders.js' to match your server.js configuration.
// routes/orders.js

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
const authenticateClient = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mouadsecret');
            req.client = { clientId: decoded.id };
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
    }
    next();
};

// POST: Create a new order
router.post('/', async (req, res) => {
    try {
        // CORRECTED: Added 'address' to the destructuring
        const { fullName, phoneNumber, wilaya, commune, address, products, status, notes } = req.body;

        // CORRECTED: Added 'address' to the validation check
        if (!fullName || !phoneNumber || !wilaya || !commune || !address || !products || products.length === 0) {
            return res.status(400).json({ message: 'Missing required fields, including address.' });
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
                return res.status(404).json({ message: `Product with ID ${productId} not found.` });
            }
            if (product.quantity < quantity) {
                return res.status(400).json({ message: `Insufficient stock for product: ${product.name}. Available: ${product.quantity}, Requested: ${quantity}` });
            }

            product.quantity -= quantity;
            await product.save();
        }

        const totalOrdersCount = products.length;

        // CORRECTED: Added 'address' to the new Order object
        const newOrder = new Order({
            fullName, phoneNumber, wilaya, commune, address, products, totalOrdersCount,
            status: status || 'pending',
            notes: notes || ''
        });

        await newOrder.save();
        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (error) {
        console.error('Create order error:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: 'Order validation failed.', errors: messages });
        }
        res.status(500).json({
            message: 'An unexpected server error occurred. Please check the error details.',
            error: { name: error.name, message: error.message, stack: error.stack }
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

        if (!orders.length) return res.status(200).json([]);

        const formattedOrders = orders.map(order => ({
            ...order._doc,
            products: order.products && Array.isArray(order.products) ? order.products.map(p => p.productId ? {
                _id: p.productId._id,
                name: p.productId.name,
                price: p.productId.price,
                images: (p.productId.images || []).map(img => `https://sheeka.onrender.com${img}`),
                quantity: p.quantity,
                color: p.color,
                size: p.size
            } : null).filter(p => p !== null) : [],
            confirmedBy: order.confirmedBy ? { _id: order.confirmedBy._id, name: order.confirmedBy.name, email: order.confirmedBy.email } : null,
            assignedTo: order.assignedTo ? { _id: order.assignedTo._id, name: order.assignedTo.name, email: order.assignedTo.email } : null
        }));

        res.status(200).json(formattedOrders);
    } catch (error) {
        console.error('Fetch orders error:', error);
        res.status(500).json({
            message: 'An unexpected server error occurred. Please check the error details.',
            error: { name: error.name, message: error.message, stack: error.stack }
        });
    }
});

// GET: Single order by ID
router.get('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId)
            .populate('products.productId')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!order) return res.status(404).json({ message: 'Order not found.' });
        
        const formattedOrder = {
            ...order._doc,
            products: order.products && Array.isArray(order.products) ? order.products.map(p => p.productId ? {
                _id: p.productId._id,
                name: p.productId.name,
                price: p.productId.price,
                images: (p.productId.images || []).map(img => `https://sheeka.onrender.com${img}`),
                quantity: p.quantity,
                color: p.color,
                size: p.size
            } : null).filter(p => p !== null) : [],
            confirmedBy: order.confirmedBy ? { _id: order.confirmedBy._id, name: order.confirmedBy.name, email: order.confirmedBy.email } : null,
            assignedTo: order.assignedTo ? { _id: order.assignedTo._id, name: order.assignedTo.name, email: order.assignedTo.email } : null
        };

        res.status(200).json(formattedOrder);
    } catch (error) {
        console.error('Fetch order error:', error);
        if (error.name === 'CastError' && error.path === '_id') {
            return res.status(400).json({ message: `Invalid order ID format: ${req.params.orderId}` });
        }
        res.status(500).json({
            message: 'An unexpected server error occurred. Please check the error details.',
            error: { name: error.name, message: error.message, stack: error.stack }
        });
    }
});

// PATCH: Unified endpoint to update any part of an order.
router.patch('/:orderId', authenticateClient, async (req, res) => {
    try {
        const { orderId } = req.params;
        // CORRECTED: Added 'address' to the destructuring
        const { fullName, phoneNumber, wilaya, commune, address, notes, assignedTo, status } = req.body;
        const updateFields = {};

        // Conditionally add fields to updateFields if they are provided
        if (fullName !== undefined) updateFields.fullName = fullName;
        if (wilaya !== undefined) updateFields.wilaya = wilaya;
        if (commune !== undefined) updateFields.commune = commune;
        // CORRECTED: Added 'address' to the update logic
        if (address !== undefined) updateFields.address = address;
        if (notes !== undefined) updateFields.notes = notes;

        if (phoneNumber !== undefined) {
            updateFields.phoneNumber = phoneNumber; // Validator will run on update
        }
        
        if (status) {
            updateFields.status = status;
            if (status === 'confirmed') {
                if (!req.client || !req.client.clientId) {
                    return res.status(401).json({ message: 'Authentication required to confirm an order.' });
                }
                updateFields.confirmedBy = req.client.clientId;
            } else {
                updateFields.confirmedBy = null;
            }
        }

        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                updateFields.assignedTo = null;
            } else {
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

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json({ message: 'Order updated successfully', order: updatedOrder });

    } catch (error) {
        console.error('Update order error:', error);

        if (error.name === 'CastError') {
            const errorMessage = `Invalid ID format for field '${error.path}'. Received value: '${error.value}'`;
            return res.status(400).json({ message: errorMessage });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: 'Order validation failed.', errors: messages });
        }

        res.status(500).json({
            message: 'An unexpected server error occurred. Please check the error details.',
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }
});


// DELETE: Remove order and restore stock
router.delete('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) return res.status(404).json({ message: 'Order not found.' });

        // Defensive check for products array
        if (order.products && Array.isArray(order.products)) {
            for (const item of order.products) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { quantity: item.quantity } });
            }
        }

        await Order.findByIdAndDelete(orderId);
        res.status(200).json({ message: 'Order deleted successfully and stock restored.' });
    } catch (error) {
        console.error('Delete order error:', error);
        if (error.name === 'CastError' && error.path === '_id') {
            return res.status(400).json({ message: `Invalid order ID format: ${req.params.orderId}` });
        }
        res.status(500).json({
            message: 'An unexpected server error occurred. Please check the error details.',
            error: { name: error.name, message: error.message, stack: error.stack }
        });
    }
});

module.exports = router;
