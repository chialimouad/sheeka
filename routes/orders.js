/**
 * FILE: ./routes/orders.js
 * DESC: Defines API endpoints for handling orders.
 *
 * FIX:
 * - Consolidated all middleware imports to use the single, correct
 * `../middleware/authMiddleware.js` file. This resolves the primary error.
 * - Removed the global `router.use(identifyTenant, protect)` call.
 * - Applied the full, explicit middleware chain (`identifyTenant`, `protect`, `isAdmin`)
 * to each protected admin route. This is a safer pattern that guarantees the
 * correct execution order and prevents middleware conflicts.
 * - Removed the `getTenantObjectId` helper function and updated all protected routes
 * to use `req.tenant._id` directly, which is simpler and more reliable.
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// --- Import Models ---
const Order = require('../models/Order');
const AbandonedCart = require('../models/AbandonedCart');
const Product = require('../models/Product');
const Client = require('../models/Client'); 

// --- Import Middleware ---
// **FIX**: All auth-related middleware is now imported from the single correct file.
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');


// =========================
// Public Routes (for placing orders)
// =========================

// This route uses the correct `identifyTenant` middleware now.
router.post('/abandoned-cart', identifyTenant, async (req, res) => {
    try {
        const { fullName, phoneNumber, product, pageUrl, wilaya, commune } = req.body;
        
        // `identifyTenant` attaches the full tenant object.
        if (!req.tenant) {
            return res.status(404).json({ message: 'Client not found.' });
        }
        const tenantObjectId = req.tenant._id;

        if (!phoneNumber || !product || !product.productId) {
            return res.status(400).json({ message: 'Phone number and product ID are required.' });
        }
        
        const filter = { tenantId: tenantObjectId, phoneNumber, 'product.productId': product.productId };
        const update = { tenantId: tenantObjectId, fullName, phoneNumber, product, pageUrl, wilaya, commune };
        const options = { upsert: true, new: true, setDefaultsOnInsert: true };

        const abandonedCart = await AbandonedCart.findOneAndUpdate(filter, update, options);
        res.status(200).json({ message: 'Abandoned cart data saved.', cart: abandonedCart });
    } catch (error) {
        console.error('Abandoned cart error:', error);
        res.status(500).json({ message: 'Server error while saving abandoned cart.' });
    }
});

// This route also uses the correct `identifyTenant` middleware.
router.post('/', identifyTenant, async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const { fullName, phoneNumber, wilaya, commune, address, products, notes, totalPrice } = req.body;
        
        if (!req.tenant) {
            return res.status(404).json({ message: 'Client not found.' });
        }
        const tenantObjectId = req.tenant._id;

        if (!fullName || !phoneNumber || !wilaya || !commune || !products || !products.length || totalPrice === undefined) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        await session.withTransaction(async () => {
            for (const item of products) {
                const product = await Product.findOne({ _id: item.productId, tenantId: tenantObjectId }).session(session);
                if (!product) {
                    throw new Error(`Product with ID ${item.productId} not found for this client.`);
                }
                if (product.quantity < item.quantity) {
                    throw new Error(`Insufficient stock for product: ${product.name}.`);
                }
                product.quantity -= item.quantity;
                await product.save({ session });
            }
        });
        
        const newOrder = new Order({
            tenantId: tenantObjectId, fullName, phoneNumber, wilaya, commune, address, products, notes, totalPrice
        });
        await newOrder.save();
        
        if (products.length > 0) {
            await AbandonedCart.deleteOne({ tenantId: tenantObjectId, phoneNumber, 'product.productId': products[0].productId });
        }

        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: error.message || 'Server error while creating order.' });
    } finally {
        session.endSession();
    }
});


// =========================
// Protected Admin Routes
// =========================

// @route   GET /api/orders
// @desc    Get all orders for the client.
// @access  Private (Admin)
router.get('/', identifyTenant, protect, isAdmin, async (req, res) => {
    try {
        const tenantObjectId = req.tenant._id; // Directly use the ID from the verified tenant.

        const orders = await Order.find({ tenantId: tenantObjectId })
            .populate('products.productId', 'name price images')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error('Fetch orders error:', error);
        res.status(500).json({ message: 'Server error fetching orders.' });
    }
});

// @route   GET /api/orders/:orderId
// @desc    Get a single order by its ID.
// @access  Private (Admin)
router.get('/:orderId', identifyTenant, protect, isAdmin, async (req, res) => {
    try {
        const tenantObjectId = req.tenant._id;
        const { orderId } = req.params;

        const order = await Order.findOne({ _id: orderId, tenantId: tenantObjectId })
            .populate('products.productId', 'name price images')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!order) {
            return res.status(404).json({ message: 'Order not found for this client.' });
        }
        res.status(200).json(order);
    } catch (error) {
        console.error('Fetch single order error:', error);
        res.status(500).json({ message: 'Server error fetching order.' });
    }
});

// @route   PUT /api/orders/:orderId
// @desc    Update order details (e.g., customer info).
// @access  Private (Admin)
router.put('/:orderId', identifyTenant, protect, isAdmin, async (req, res) => {
    try {
        const tenantObjectId = req.tenant._id;
        const { orderId } = req.params;
        const updateData = req.body;

        const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId, tenantId: tenantObjectId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found for this client.' });
        }
        res.status(200).json({ message: 'Order updated successfully', order: updatedOrder });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ message: 'Server error updating order.' });
    }
});

// @route   PATCH /api/orders/:orderId/status
// @desc    Update the status of an order (e.g., confirm, ship).
// @access  Private (Admin)
router.patch('/:orderId/status', identifyTenant, protect, isAdmin, async (req, res) => {
    try {
        const tenantObjectId = req.tenant._id;
        const { orderId } = req.params;
        const { status, notes } = req.body;

        const order = await Order.findOne({ _id: orderId, tenantId: tenantObjectId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found for this client.' });
        }

        let hasUpdate = false;
        if (status) {
            order.status = status;
            order.statusTimestamps.set(status, new Date());
            if (status === 'confirmed') {
                order.confirmedBy = req.user.id;
            }
            hasUpdate = true;
        }
        if (notes !== undefined) {
            order.notes = notes;
            hasUpdate = true;
        }
        if (!hasUpdate) {
            return res.status(400).json({ message: 'No status or notes provided for update.' });
        }

        await order.save();
        const populatedOrder = await Order.findById(orderId).populate('confirmedBy', 'name email').populate('assignedTo', 'name email');
        res.status(200).json({ message: 'Order status updated successfully', order: populatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error updating order status.' });
    }
});

// @route   DELETE /api/orders/:orderId
// @desc    Delete an order and restore product stock.
// @access  Private (Admin)
router.delete('/:orderId', identifyTenant, protect, isAdmin, async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const tenantObjectId = req.tenant._id;
        const { orderId } = req.params;

        let deletedOrder;
        await session.withTransaction(async () => {
            const order = await Order.findOne({ _id: orderId, tenantId: tenantObjectId }).session(session);
            if (!order) {
                throw new Error('Order not found for this client.');
            }

            for (const item of order.products) {
                await Product.updateOne(
                    { _id: item.productId, tenantId: tenantObjectId },
                    { $inc: { quantity: item.quantity } },
                    { session }
                );
            }
            
            deletedOrder = await Order.findOneAndDelete({ _id: orderId, tenantId: tenantObjectId }).session(session);
        });

        if (!deletedOrder) {
             return res.status(404).json({ message: 'Order not found for this client.' });
        }

        res.status(200).json({ message: 'Order deleted successfully and stock restored.' });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ message: error.message || 'Server error deleting order.' });
    } finally {
        session.endSession();
    }
});

module.exports = router;
