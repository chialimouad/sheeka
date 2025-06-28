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
      // Verify the token using the secret from environment variables or a default
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mouadsecret');
      req.client = { clientId: decoded.id }; // Attach the client ID to the request object
    } catch (err) {
      // If token is invalid or expired, return a 401 Unauthorized response
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  }
  next(); // Proceed to the next middleware or route handler
};

// POST: Create a new order
router.post('/', async (req, res) => {
  try {
    const { fullName, phoneNumber, wilaya, commune, products, status, notes } = req.body;

    // Validate required fields are present
    if (!fullName || !phoneNumber || !wilaya || !commune || !products || products.length === 0) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    // Validate Algerian phone number format
    const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ message: 'Invalid Algerian phone number.' });
    }

    let totalQuantity = 0; // Initialize total quantity for the new order

    // Iterate through products to validate and update stock
    for (const item of products) {
      const { productId, quantity, color, size } = item;
      // Validate each product item has necessary fields
      if (!productId || !quantity || !color || !size) {
        return res.status(400).json({ message: 'Each product must include ID, quantity, color, and size.' });
      }

      const product = await Product.findById(productId);
      // Check if product exists and if there's sufficient stock
      if (!product || product.quantity < quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product?.name || 'a product'}` });
      }

      // Decrease product quantity in stock and save
      product.quantity -= quantity;
      await product.save();

      totalQuantity += quantity; // Add current product's quantity to total
    }

    // Create a new order instance
    const newOrder = new Order({
      fullName,
      phoneNumber,
      wilaya,
      commune,
      products,
      totalQuantityOfItems: totalQuantity, // Assign the calculated total quantity
      status: status || 'pending', // Default status to 'pending' if not provided
      notes: notes || '' // Default notes to empty string if not provided
    });

    // Save the new order to the database
    await newOrder.save();
    // Respond with success message and the created order
    res.status(201).json({ message: 'Order created', order: newOrder });
  } catch (error) {
    // Log and send server error response
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET: All orders
router.get('/', async (req, res) => {
  try {
    // Find all orders and populate related product, confirmedBy, and assignedTo fields
    const orders = await Order.find()
      .populate('products.productId')
      .populate('confirmedBy', 'name email')
      .populate('assignedTo', 'name email');

    // If no orders are found, return a 404 response
    if (!orders.length) return res.status(404).json({ message: 'No orders found.' });

    // Format the orders for the response, including full product details
    const formatted = orders.map(order => ({
      ...order._doc, // Spread the original document fields
      products: order.products.map(p => p.productId ? {
        _id: p.productId._id,
        name: p.productId.name,
        price: p.productId.price,
        // Ensure image URLs are correctly prefixed
        images: (p.productId.images || []).map(img => `https://sheeka.onrender.com${img}`),
        quantity: p.quantity,
        color: p.color,
        size: p.size
      } : {}), // Handle cases where productId might not be populated
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

    // Send the formatted orders as a JSON response
    res.status(200).json(formatted);
  } catch (error) {
    // Log and send server error response
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

    // If order not found, return a 404 response
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    // Format the single order for the response
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

    // Send the formatted order as a JSON response
    res.status(200).json(formatted);
  } catch (error) {
    // Log and send server error response
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

    // Validate and set status
    if (status) {
      const allowedStatuses = ['pending', 'confirmed', 'tentative', 'cancelled'];
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

    // Set notes if provided
    if (notes !== undefined) updateFields.notes = notes;

    // If no fields are provided for update, return a 400 response
    if (!Object.keys(updateFields).length) {
      return res.status(400).json({ message: 'No fields provided to update.' });
    }

    // Find and update the order, returning the new document
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updateFields },
      { new: true, runValidators: true } // new: true returns the modified document; runValidators ensures schema validations apply
    ).populate('products.productId')
      .populate('confirmedBy', 'name email')
      .populate('assignedTo', 'name email');

    // If order not found, return a 404 response
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Send success response
    res.status(200).json({ message: 'Order updated', order: updatedOrder });
  } catch (error) {
    // Log and send server error response
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

    // Build updateFields object based on provided data
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
      // Handle setting assignedTo to null or a valid user ID
      if (assignedTo === null || assignedTo === '') {
        updateFields.assignedTo = null;
      } else {
        // Validate if the assigned user exists
        const user = await User.findById(assignedTo);
        if (!user) {
          return res.status(400).json({ message: 'Assigned user not found.' });
        }
        updateFields.assignedTo = assignedTo;
      }
    }

    // If no valid fields are provided for update, return a 400 response
    if (!Object.keys(updateFields).length) {
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    // Find and update the order, returning the new document with populated fields
    const updated = await Order.findByIdAndUpdate(orderId, { $set: updateFields }, { new: true, runValidators: true })
      .populate('products.productId')
      .populate('confirmedBy', 'name email')
      .populate('assignedTo', 'name email');

    // If order not found, return a 404 response
    if (!updated) return res.status(404).json({ message: 'Order not found.' });
    // Send success response
    res.status(200).json({ message: 'Order updated', order: updated });
  } catch (error) {
    // Log and send server error response
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE: Remove order
router.delete('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    // If order not found, return a 404 response
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    // Restore product quantities before deleting the order
    for (const item of order.products) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    // Delete the order from the database
    await Order.findByIdAndDelete(orderId);
    // Send success response
    res.status(200).json({ message: 'Order deleted.' });
  } catch (error) {
    // Log and send server error response
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export router
module.exports = router;
