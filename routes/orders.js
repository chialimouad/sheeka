// routes/orderRoutes.js
// Required Modules
const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables from .env file

const router = express.Router();

// Import Mongoose Models (ensure these paths are correct relative to your project structure)
const Order = require('../models/Order'); // Corrected import path for Order model
const Product = require('../models/Product');
const User = require('../models/User');

// Middleware to extract client ID from JWT token
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
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
    }
    // Proceed to the next middleware or route handler
    next();
};

// POST: Create a new order
router.post('/', async (req, res) => {
    try {
        // UPDATED: Added 'address' to destructuring
        const { fullName, phoneNumber, wilaya, commune, address, products, status, notes } = req.body;

        // Basic validation for required fields, including 'address'
        if (!fullName || !phoneNumber || !wilaya || !commune || !address || !products || products.length === 0) {
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
            // Validate product item fields
            if (!productId || !quantity || !color || !size) {
                return res.status(400).json({ message: 'Each product must include ID, quantity, color, and size.' });
            }

            const product = await Product.findById(productId);
            // Check if product exists and if there's sufficient stock
            if (!product) {
                return res.status(400).json({ message: `Product with ID ${productId} not found.` });
            }
            if (product.quantity < quantity) {
                return res.status(400).json({ message: `Insufficient stock for product: ${product.name}. Available: ${product.quantity}, Requested: ${quantity}` });
            }

            // Decrease product quantity in stock
            product.quantity -= quantity;
            await product.save(); // Save updated product quantity
        }

        // Calculate totalOrdersCount based on the number of distinct products in the order
        const totalOrdersCount = products.length;

        // Create a new Order instance, including the 'address' field
        const newOrder = new Order({
            fullName,
            phoneNumber,
            wilaya,
            commune,
            address, // NEW: Added address field
            products,
            totalOrdersCount,
            status: status || 'pending',
            notes: notes || ''
        });

        await newOrder.save(); // Save the new order to the database
        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET: All orders
router.get('/', async (req, res) => {
    try {
        // Find all orders and populate product details, confirmedBy, and assignedTo user details
        const orders = await Order.find()
            .populate('products.productId')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!orders.length) return res.status(404).json({ message: 'No orders found.' });

        // Format the output to include full image URLs and specific user fields
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
            } : null),
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
        // Find a single order by ID and populate related fields
        const order = await Order.findById(req.params.orderId)
            .populate('products.productId')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!order) return res.status(404).json({ message: 'Order not found.' });

        // Format the output similar to the GET all orders route
        const formattedOrder = {
            ...order._doc,
            products: order.products.map(p => ({
                _id: p.productId._id,
                name: p.productId.name,
                price: p.productId.price,
                images: (p.productId.images || []).map(img => `https://sheeka.onrender.com${img}`),
                quantity: p.quantity,
                color: p.color,
                size: p.size
            })),
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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// PATCH: Update order status and notes
router.patch('/:orderId/status', authenticateClient, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, notes } = req.body;

        const updateFields = {};

        // If status is provided, validate it
        if (status) {
            // UPDATED: Added new statuses to the allowed list
            const allowedStatuses = ['pending', 'confirmed', 'tentative', 'cancelled', 'dispatched', 'delivered', 'returned'];
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ message: 'Invalid status. Allowed: ' + allowedStatuses.join(', ') });
            }
            updateFields.status = status;

            // If status is 'confirmed', set confirmedBy to the authenticated client's ID
            if (status === 'confirmed') {
                if (!req.client || !req.client.clientId) {
                    return res.status(401).json({ message: 'Unauthorized. Agent must be logged in to confirm order.' });
                }
                updateFields.confirmedBy = req.client.clientId;
            } else {
                // If status is not 'confirmed', clear confirmedBy
                updateFields.confirmedBy = null;
            }
        }

        // If notes is provided, update it
        if (notes !== undefined) updateFields.notes = notes;

        // If no valid fields are provided for update
        if (!Object.keys(updateFields).length) {
            return res.status(400).json({ message: 'No fields provided to update status or notes.' });
        }

        // Find and update the order
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { $set: updateFields },
            { new: true, runValidators: true } // Return the updated document and run schema validators
        )
            .populate('products.productId')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json({ message: 'Order status updated successfully', order: updatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// PATCH: General order update for other fields (fullName, phoneNumber, wilaya, commune, address, notes, assignedTo)
router.patch('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        // UPDATED: Added 'address' to destructuring
        const { fullName, phoneNumber, wilaya, commune, address, notes, assignedTo } = req.body;
        const updateFields = {};

        // Conditionally add fields to updateFields if they are provided in the request body
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
        if (address !== undefined) updateFields.address = address; // NEW: Handle address update
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

        if (!Object.keys(updateFields).length) {
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

        // Before deleting, return product quantities to stock
        for (const item of order.products) {
            const product = await Product.findById(item.productId);
            if (product) {
                product.quantity += item.quantity; // Add quantity back to stock
                await product.save(); // Save updated product quantity
            }
        }

        await Order.findByIdAndDelete(orderId); // Delete the order
        res.status(200).json({ message: 'Order deleted successfully and stock restored.' });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Export the router for use in your main Express application
module.exports = router;
