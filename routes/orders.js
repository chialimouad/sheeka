// routes/orders.js

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// --- Import Models ---
const Order = require('../models/Order');
const AbandonedCart = require('../models/AbandonedCart');
const Product = require('../models/Product');
// **FIX**: We now need the Client model to look up the correct tenant ObjectId.
// Make sure the path to your Client model is correct.
const Client = require('../models/Client'); 

// --- Import Middleware ---
const { identifyTenant } = require('../middleware/tenantMiddleware');
const { protect, isAdmin } = require('../middleware/authMiddleware');


// =========================
// Public Routes
// =========================
// ... (Public routes remain unchanged)
router.post('/abandoned-cart', identifyTenant, async (req, res) => {
    try {
        const { fullName, phoneNumber, product, pageUrl, wilaya, commune } = req.body;
        const tenantIdentifier = req.tenantId;

        if (!phoneNumber || !product || !product.productId) {
            return res.status(400).json({ message: 'Phone number and product ID are required.' });
        }
        
        // **FIX**: Changed query to use `tenantId` which is the correct field in the Client model.
        const client = await Client.findOne({ tenantId: tenantIdentifier });
        if (!client) {
            return res.status(404).json({ message: 'Client not found.' });
        }

        const filter = { tenantId: client._id, phoneNumber, 'product.productId': product.productId };
        const update = { tenantId: client._id, fullName, phoneNumber, product, pageUrl, wilaya, commune };
        const options = { upsert: true, new: true, setDefaultsOnInsert: true };

        const abandonedCart = await AbandonedCart.findOneAndUpdate(filter, update, options);
        res.status(200).json({ message: 'Abandoned cart data saved.', cart: abandonedCart });
    } catch (error) {
        console.error('Abandoned cart error:', error);
        res.status(500).json({ message: 'Server error while saving abandoned cart.' });
    }
});

router.post('/', identifyTenant, async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const { fullName, phoneNumber, wilaya, commune, address, products, notes, totalPrice } = req.body;
        const tenantIdentifier = req.tenantId;

        if (!fullName || !phoneNumber || !wilaya || !commune || !products || !products.length || totalPrice === undefined) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        // **FIX**: Changed query to use `tenantId` which is the correct field in the Client model.
        const client = await Client.findOne({ tenantId: tenantIdentifier });
        if (!client) {
            return res.status(404).json({ message: 'Client not found.' });
        }
        const tenantObjectId = client._id;

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
router.use(identifyTenant, protect);

// **HELPER FUNCTION TO GET TENANT OBJECT ID**
// This avoids repeating the same logic in every route.
const getTenantObjectId = async (req, res) => {
    const tenantIdentifier = req.user.tenantId; // e.g., "1001" from the JWT
    if (!tenantIdentifier) {
        res.status(400).json({ message: 'Tenant identifier not found in user token.' });
        return null;
    }
    // **FIX**: Changed query to use `tenantId` which is the correct field in the Client model.
    const client = await Client.findOne({ tenantId: tenantIdentifier });
    if (!client) {
        res.status(404).json({ message: 'Client not found for the provided tenant ID.' });
        return null;
    }
    return client._id; // The actual ObjectId
};


// @route   GET /api/orders
// @desc    Get all orders for the client.
// @access  Private (Admin)
router.get('/', isAdmin, async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return; // Error response already sent by helper

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
router.get('/:orderId', isAdmin, async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

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
router.put('/:orderId', isAdmin, async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

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
router.patch('/:orderId/status', isAdmin, async (req, res) => {
    try {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

        const { orderId } = req.params;
        const { status, notes } = req.body;

        const order = await Order.findOne({ _id: orderId, tenantId: tenantObjectId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found for this client.' });
        }

        // ... (rest of the logic is fine)
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
router.delete('/:orderId', isAdmin, async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const tenantObjectId = await getTenantObjectId(req, res);
        if (!tenantObjectId) return;

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

// ... (Abandoned cart admin routes would also need this fix if they use req.user.tenantId)

module.exports = router;
