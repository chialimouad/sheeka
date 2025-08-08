/**
 * FILE: ./routes/orders.js
 * DESC: Defines API endpoints for handling orders, with email notifications.
 *
 * CHANGE:
 * - Added a new protected admin route `DELETE /abandoned/:cartId` to handle cart deletion.
 * - Added a new protected admin route `GET /abandoned` to fetch all abandoned cart records.
 * - Integrated `nodemailer` to send an email notification to the client
 * when a new order is created.
 * - Added a new utility function `sendOrderConfirmationEmail` for sending emails.
 *
 * REQUIREMENT:
 * - You must install nodemailer: `npm install nodemailer`
 * - You must set the following environment variables in your .env file:
 * - EMAIL_HOST (e.g., 'smtp.gmail.com')
 * - EMAIL_PORT (e.g., 587)
 * - EMAIL_USER (your email address)
 * - EMAIL_PASS (your email password or an app-specific password)
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer'); // Import nodemailer

// --- Import Models ---
const Order = require('../models/Order');
const AbandonedCart = require('../models/AbandonedCart');
const Product = require('../models/Product');
const Client = require('../models/Client');

// --- Import Middleware ---
const { identifyTenant, protect, isAdmin } = require('../middleware/authMiddleware');

// =========================
// Nodemailer Configuration
// =========================
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_PORT == 465, // Use 'true' for port 465, 'false' for others
    auth: {
        user: process.env.EMAIL_USER, // Your email address from .env file
        pass: process.env.EMAIL_PASS, // Your email password from .env file
    },
});

/**
 * Sends a new order confirmation email to the client.
 * @param {string} clientEmail - The email address of the client to notify.
 * @param {object} order - The full, populated order object.
 */
const sendOrderConfirmationEmail = async (clientEmail, order) => {
    const productListHtml = order.products.map(item =>
        `<li>${item.quantity} x ${item.productId.name} (ID: ${item.productId._id})</li>`
    ).join('');

    const mailOptions = {
        from: `"Your Store Platform" <${process.env.EMAIL_USER}>`,
        to: clientEmail,
        subject: `🎉 New Order Received! [Order #${order._id}]`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #4CAF50;">You've Received a New Order!</h2>
                <p>Hello,</p>
                <p>A new order has been placed through your store. Here are the details:</p>
                <hr>
                <h3>Order Details</h3>
                <ul>
                    <li><strong>Order ID:</strong> ${order._id}</li>
                    <li><strong>Customer Name:</strong> ${order.fullName}</li>
                    <li><strong>Phone Number:</strong> ${order.phoneNumber}</li>
                    <li><strong>Total Price:</strong> ${order.totalPrice} DZD</li>
                    <li><strong>Shipping Address:</strong> ${order.address || ''}, ${order.commune}, ${order.wilaya}</li>
                    <li><strong>Notes:</strong> ${order.notes || 'N/A'}</li>
                </ul>
                <h3>Products Ordered</h3>
                <ul>
                    ${productListHtml}
                </ul>
                <p>Please log in to your admin dashboard to view the full order details and manage fulfillment.</p>
                <br>
                <p>Thank you,</p>
                <p><strong>Your Store Platform Team</strong></p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Order confirmation email sent successfully to ${clientEmail}`);
    } catch (error) {
        console.error(`Error sending email to ${clientEmail}:`, error);
    }
};


// =========================
// Public Routes (for placing orders)
// =========================

router.post('/abandoned-cart', identifyTenant, async (req, res) => {
    try {
        const { fullName, phoneNumber, product, pageUrl, wilaya, commune } = req.body;
        
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

        if (req.tenant && req.tenant.adminEmail) {
            const populatedOrder = await Order.findById(newOrder._id).populate('products.productId', 'name');
            await sendOrderConfirmationEmail(req.tenant.adminEmail, populatedOrder);
        } else {
            console.log('Client admin email not found, skipping email notification.');
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

router.get('/abandoned', identifyTenant, protect, isAdmin, async (req, res) => {
    try {
        if (!req.tenant) {
            return res.status(404).json({ message: 'Client not found.' });
        }
        const tenantObjectId = req.tenant._id;
        const carts = await AbandonedCart.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 });
        res.status(200).json(carts);
    } catch (error) {
        console.error('Fetch abandoned carts error:', error);
        res.status(500).json({ message: 'Server error fetching abandoned carts.' });
    }
});

// *** NEW ROUTE FOR DELETING ABANDONED CARTS ***
router.delete('/abandoned/:cartId', identifyTenant, protect, isAdmin, async (req, res) => {
    try {
        if (!req.tenant) {
            return res.status(404).json({ message: 'Client not found.' });
        }
        const tenantObjectId = req.tenant._id;
        const { cartId } = req.params;

        const deletedCart = await AbandonedCart.findOneAndDelete({ _id: cartId, tenantId: tenantObjectId });

        if (!deletedCart) {
            return res.status(404).json({ message: 'Abandoned cart not found for this client.' });
        }

        res.status(200).json({ message: 'Abandoned cart deleted successfully.' });
    } catch (error) {
        console.error('Delete abandoned cart error:', error);
        res.status(500).json({ message: 'Server error deleting abandoned cart.' });
    }
});


router.get('/', identifyTenant, protect, isAdmin, async (req, res) => {
    try {
        const tenantObjectId = req.tenant._id;

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
