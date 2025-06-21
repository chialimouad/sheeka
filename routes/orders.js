// Required Modules
const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User'); // Ensure User model is imported

// Middleware to extract client ID from JWT token
const authenticateClient = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            // Verify the token using the secret from environment variables or a fallback
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mouadsecret');
            req.client = { clientId: decoded.id }; // Attach client ID to the request
        } catch (err) {
            // Handle invalid or expired tokens
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
    } else {
        // If no token is provided, respond with unauthorized unless it's a public route
        return res.status(401).json({ message: 'Authorization token required' });
    }
    next(); // Proceed to the next middleware or route handler
};

// POST: Create a new order (does not require authentication for public customers)
router.post('/', async (req, res) => {
    try {
        const { fullName, phoneNumber, wilaya, commune, products, status, notes } = req.body;

        // Validate required fields for order creation
        if (!fullName || !phoneNumber || !wilaya || !commune || !products || products.length === 0) {
            return res.status(400).json({ message: 'Missing required fields (fullName, phoneNumber, wilaya, commune, products).' });
        }

        // Validate Algerian phone number format
        const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({ message: 'Invalid Algerian phone number format.' });
        }

        // Process each product in the order
        for (const item of products) {
            const { productId, quantity, color, size } = item;
            // Validate product details
            if (!productId || !quantity || !color || !size) {
                return res.status(400).json({ message: 'Each product must include ID, quantity, color, and size.' });
            }
            // Find product and check stock
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ message: `Product with ID ${productId} not found.` });
            }
            if (product.quantity < quantity) {
                return res.status(400).json({ message: `Insufficient stock for product: ${product.name}. Available: ${product.quantity}, Requested: ${quantity}` });
            }
            // Decrement product quantity
            product.quantity -= quantity;
            await product.save();
        }

        // Create new order instance
        const newOrder = new Order({
            fullName,
            phoneNumber,
            wilaya,
            commune,
            products,
            status: status || 'pending', // Default status to 'pending'
            notes: notes || '' // Default notes to empty string
        });
        await newOrder.save(); // Save the new order to the database

        // Respond with success message and the created order
        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (error) {
        // Log and respond with server error
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Server error during order creation', error: error.message });
    }
});

// GET: All orders (requires authentication for agents to view all orders)
router.get('/', authenticateClient, async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('products.productId') // Populate product details within the order
            .populate('confirmedBy', 'name email') // Populate confirmedBy user's name and email
            .populate('assignedTo', 'name email'); // Populate assignedTo user's name and email

        if (!orders.length) {
            return res.status(404).json({ message: 'No orders found.' });
        }

        // Format orders for response, including image URLs and populated user details
        const formatted = orders.map(order => ({
            ...order._doc, // Include all original document fields
            products: order.products.map(p => p.productId ? {
                _id: p.productId._id,
                name: p.productId.name,
                price: p.productId.price,
                // Construct full image URLs; assuming 'images' is an array of paths
                images: (p.productId.images || []).map(img => `https://sheeka.onrender.com${img}`),
                quantity: p.quantity,
                color: p.color,
                size: p.size
            } : null).filter(Boolean), // Filter out any null products if productId was not found
            confirmedBy: order.confirmedBy ? {
                _id: order.confirmedBy._id,
                name: order.confirmedBy.name,
                email: order.confirmedBy.email
            } : null, // Set to null if not confirmed by anyone
            assignedTo: order.assignedTo ? {
                _id: order.assignedTo._id,
                name: order.assignedTo.name,
                email: order.assignedTo.email
            } : null // Set to null if not assigned to anyone
        }));

        res.status(200).json(formatted);
    } catch (error) {
        console.error('Fetch orders error:', error);
        res.status(500).json({ message: 'Server error during fetching orders', error: error.message });
    }
});

// GET: Single order by ID (requires authentication)
router.get('/:orderId', authenticateClient, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('products.productId')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Format the single order response
        const formatted = {
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

        res.status(200).json(formatted);
    } catch (error) {
        console.error('Fetch single order error:', error);
        res.status(500).json({ message: 'Server error during fetching single order', error: error.message });
    }
});

// PATCH: Update order status and notes (requires authentication for agents)
router.patch('/:orderId/status', authenticateClient, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, notes } = req.body;

        const updateFields = {};

        if (status) {
            const allowedStatuses = ['pending', 'confirmed', 'tentative', 'cancelled', 'dispatched', 'delivered']; // Added 'dispatched' and 'delivered'
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ message: 'Invalid status. Allowed statuses: ' + allowedStatuses.join(', ') });
            }
            updateFields.status = status;

            // Automatically set or clear 'confirmedBy' based on status
            if (status === 'confirmed') {
                if (!req.client || !req.client.clientId) {
                    return res.status(401).json({ message: 'Unauthorized. Agent must be logged in to confirm an order.' });
                }
                updateFields.confirmedBy = req.client.clientId; // Set the ID of the confirming agent
            } else {
                updateFields.confirmedBy = null; // Clear confirmedBy if status changes from 'confirmed'
            }
        }

        // Allow clearing notes by sending `notes: ""`
        if (notes !== undefined) {
            updateFields.notes = notes;
        }

        // If no fields are provided for update, return a bad request
        if (!Object.keys(updateFields).length) {
            return res.status(400).json({ message: 'No valid fields provided to update order status or notes.' });
        }

        // Find and update the order, return the new document and run schema validators
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

        res.status(200).json({ message: 'Order status and notes updated successfully', order: updatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error during status update', error: error.message });
    }
});

// PATCH: General order update (requires authentication for agents)
router.patch('/:orderId', authenticateClient, async (req, res) => { // Added authenticateClient middleware
    try {
        const { orderId } = req.params;
        const { fullName, phoneNumber, wilaya, commune, notes, assignedTo } = req.body;
        const updateFields = {};

        // Only add fields to updateFields if they are provided in the request body
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
        // Allow clearing notes by sending `notes: ""`
        if (notes !== undefined) updateFields.notes = notes;

        // Handle assignedTo: allow assigning to a user or unassigning (null/empty string)
        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                updateFields.assignedTo = null; // Unassign the order
            } else {
                // Check if the assigned user exists
                const user = await User.findById(assignedTo);
                if (!user) {
                    return res.status(400).json({ message: 'Assigned user not found with the provided ID.' });
                }
                updateFields.assignedTo = assignedTo; // Assign the order to the user
            }
        }

        // If no valid fields are provided for update, return a bad request
        if (!Object.keys(updateFields).length) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        // Find and update the order, returning the new document and running schema validators
        const updated = await Order.findByIdAndUpdate(orderId, { $set: updateFields }, { new: true, runValidators: true })
            .populate('products.productId')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!updated) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json({ message: 'Order updated successfully', order: updated });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ message: 'Server error during general order update', error: error.message });
    }
});

// DELETE: Remove order (requires authentication for agents/admins)
router.delete('/:orderId', authenticateClient, async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Before deleting, return product quantities to stock
        for (const item of order.products) {
            const product = await Product.findById(item.productId);
            if (product) {
                product.quantity += item.quantity; // Add quantity back to stock
                await product.save();
            }
        }

        await Order.findByIdAndDelete(orderId); // Delete the order
        res.status(200).json({ message: 'Order deleted successfully and product quantities restored.' });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ message: 'Server error during order deletion', error: error.message });
    }
});

// Export router for use in other parts of the application
module.exports = router;
