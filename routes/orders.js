// controllers/orderController.js

const Order = require('../models/Order');
const AbandonedCart = require('../models/AbandonedCart');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { validationResult, param } = require('express-validator');

// =========================
// Abandoned Cart Handlers (Tenant-Aware)
// =========================

exports.saveAbandonedCart = async (req, res) => {
    try {
        const { fullName, phoneNumber, product, pageUrl, wilaya, commune } = req.body;
        const tenantId = req.tenantId; // From identifyTenant middleware

        if (!phoneNumber || !product || !product.productId) {
            return res.status(400).json({ message: 'Phone number and product ID are required.' });
        }

        const filter = { tenantId, phoneNumber, 'product.productId': product.productId };
        const update = {
            tenantId, fullName, phoneNumber, product, pageUrl, wilaya, commune
        };
        const options = { upsert: true, new: true, setDefaultsOnInsert: true };

        const abandonedCart = await AbandonedCart.findOneAndUpdate(filter, update, options);
        res.status(200).json({ message: 'Abandoned cart data saved.', cart: abandonedCart });
    } catch (error) {
        console.error('Abandoned cart error:', error);
        res.status(500).json({ message: 'Server error while saving abandoned cart.' });
    }
};

exports.getAbandonedCarts = async (req, res) => {
    try {
        const tenantId = req.user.tenantId; // From protect middleware (admin only)
        const carts = await AbandonedCart.find({ tenantId }).sort({ createdAt: -1 });
        res.status(200).json(carts);
    } catch (error) {
        console.error('Fetch abandoned carts error:', error);
        res.status(500).json({ message: 'Server error fetching abandoned carts.' });
    }
};

exports.deleteAbandonedCart = [
    param('cartId').isMongoId(),
    async (req, res) => {
        try {
            const { cartId } = req.params;
            const tenantId = req.user.tenantId; // Admin only

            const result = await AbandonedCart.findOneAndDelete({ _id: cartId, tenantId });
            if (!result) {
                return res.status(404).json({ message: 'Abandoned cart not found for this client.' });
            }
            res.status(200).json({ message: 'Abandoned cart deleted successfully.' });
        } catch (error) {
            console.error('Delete abandoned cart error:', error);
            res.status(500).json({ message: 'Server error deleting abandoned cart.' });
        }
    }
];


// =========================
// Order Handlers (Tenant-Aware)
// =========================

exports.createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const { fullName, phoneNumber, wilaya, commune, address, products, notes, totalPrice } = req.body;
        const tenantId = req.tenantId; // From identifyTenant middleware

        if (!fullName || !phoneNumber || !wilaya || !commune || !products || !products.length || totalPrice === undefined) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        // Atomically check stock and decrement quantities
        await session.withTransaction(async () => {
            for (const item of products) {
                const product = await Product.findOne({ _id: item.productId, tenantId }).session(session);
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
            tenantId, fullName, phoneNumber, wilaya, commune, address, products, notes, totalPrice
        });
        await newOrder.save();
        
        // Asynchronously remove any corresponding abandoned cart
        if (products.length > 0) {
            await AbandonedCart.deleteOne({ tenantId, phoneNumber, 'product.productId': products[0].productId });
        }

        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: error.message || 'Server error while creating order.' });
    } finally {
        session.endSession();
    }
};

exports.getOrders = async (req, res) => {
    try {
        const tenantId = req.user.tenantId; // Admin only
        const orders = await Order.find({ tenantId })
            .populate('products.productId', 'name price images')
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error('Fetch orders error:', error);
        res.status(500).json({ message: 'Server error fetching orders.' });
    }
};

exports.getOrderById = [
    param('orderId').isMongoId(),
    async (req, res) => {
        try {
            const { orderId } = req.params;
            const tenantId = req.user.tenantId; // Admin only
            const order = await Order.findOne({ _id: orderId, tenantId })
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
    }
];

exports.updateOrder = [
    param('orderId').isMongoId(),
    async (req, res) => {
        try {
            const { orderId } = req.params;
            const tenantId = req.user.tenantId; // Admin only
            const updateData = req.body;

            const updatedOrder = await Order.findOneAndUpdate(
                { _id: orderId, tenantId },
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
    }
];

exports.updateOrderStatus = [
    param('orderId').isMongoId(),
    async (req, res) => {
        try {
            const { orderId } = req.params;
            const { status, notes } = req.body;
            const tenantId = req.user.tenantId; // Admin only

            const order = await Order.findOne({ _id: orderId, tenantId });
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
    }
];

exports.deleteOrder = [
    param('orderId').isMongoId(),
    async (req, res) => {
        const session = await mongoose.startSession();
        try {
            const { orderId } = req.params;
            const tenantId = req.user.tenantId; // Admin only

            let deletedOrder;
            await session.withTransaction(async () => {
                const order = await Order.findOne({ _id: orderId, tenantId }).session(session);
                if (!order) {
                    throw new Error('Order not found for this client.');
                }

                // Restore stock
                for (const item of order.products) {
                    await Product.updateOne(
                        { _id: item.productId, tenantId },
                        { $inc: { quantity: item.quantity } },
                        { session }
                    );
                }
                
                deletedOrder = await Order.findOneAndDelete({ _id: orderId, tenantId }).session(session);
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
    }
];
