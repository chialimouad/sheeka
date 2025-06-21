// Required Modules
const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const router = express.Router();
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
    const { fullName, phoneNumber, wilaya, commune, products, status, notes } = req.body;

    if (!fullName || !phoneNumber || !wilaya || !commune || !products || products.length === 0) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

      const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ message: 'Invalid Algerian phone number.' });
    }

    for (const item of products) {
      const { productId, quantity, color, size } = item;
      if (!productId || !quantity || !color || !size) {
        return res.status(400).json({ message: 'Each product must include ID, quantity, color, and size.' });
      }
      const product = await Product.findById(productId);
      if (!product || product.quantity < quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product?.name || 'a product'}` });
      }
      product.quantity -= quantity;
      await product.save();
    }

    const newOrder = new Order({
      fullName,
      phoneNumber,
      wilaya,
      commune,
      products,
      status: status || 'pending',
      notes: notes || ''
    });
    await newOrder.save();
    res.status(201).json({ message: 'Order created', order: newOrder });
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

    const formatted = orders.map(order => ({
      ...order._doc,
      products: order.products.map(p => p.productId ? {
        _id: p.productId._id,
        name: p.productId.name,
        price: p.productId.price,
        images: (p.productId.images || []).map(img => `https://sheeka.onrender.com${img}`),
        quantity: p.quantity,
        color: p.color,
        size: p.size
      } : {}),
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

    res.status(200).json(formatted);
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

    if (status) {
      const allowedStatuses = ['pending', 'confirmed', 'tentative', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Allowed: ' + allowedStatuses.join(', ') });
      }
      updateFields.status = status;

      if (status === 'confirmed') {
        if (!req.client || !req.client.clientId) {
          return res.status(401).json({ message: 'Unauthorized. Agent must be logged in to confirm order.' });
        }
        updateFields.confirmedBy = req.client.clientId;
      } else {
        updateFields.confirmedBy = null;
      }
    }

    if (notes !== undefined) updateFields.notes = notes;

    if (!Object.keys(updateFields).length) {
      return res.status(400).json({ message: 'No fields provided to update.' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('products.productId')
     .populate('confirmedBy', 'name email')
     .populate('assignedTo', 'name email');

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    res.status(200).json({ message: 'Order updated', order: updatedOrder });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PATCH: General order update
router.patch('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { fullName, phoneNumber, wilaya, commune, notes, assignedTo } = req.body;
    const updateFields = {};

    if (fullName !== undefined) updateFields.fullName = fullName;
    if (phoneNumber !== undefined) {
       const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }
      updateFields.phoneNumber = phoneNumber;
    }
    if (wilaya !== undefined) updateFields.wilaya = wilaya;
    if (commune !== undefined) updateFields.commune = commune;
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

    const updated = await Order.findByIdAndUpdate(orderId, { $set: updateFields }, { new: true, runValidators: true })
      .populate('products.productId')
      .populate('confirmedBy', 'name email')
      .populate('assignedTo', 'name email');

    if (!updated) return res.status(404).json({ message: 'Order not found.' });
    res.status(200).json({ message: 'Order updated', order: updated });
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

    for (const item of order.products) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    await Order.findByIdAndDelete(orderId);
    res.status(200).json({ message: 'Order deleted.' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export router
module.exports = router;
