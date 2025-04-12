const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');

// ✅ Create a new order
router.post('/', async (req, res) => {
  try {
    const { fullName, phoneNumber, wilaya, commune, products } = req.body;

    // Ensure all required fields are present
    if (!fullName || !phoneNumber || !wilaya || !commune || !products.length) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate phone number format
    const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ message: 'Invalid Algerian phone number' });
    }

    // Check if all products exist and validate product details
    for (const item of products) {
      const { productId, quantity, color, size } = item;

      // Check if product ID, quantity, color, and size are provided
      if (!productId || !quantity || !color || !size) {
        return res.status(400).json({ message: 'Product ID, quantity, color, and size are required for each product' });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(400).json({ message: `Product with ID ${productId} not found` });
      }

      if (product.quantity < quantity) {
        return res.status(400).json({ message: `Not enough stock for product: ${product.name}` });
      }

      // Reduce the product quantity in stock
      product.quantity -= quantity;
      await product.save();
    }

    // Create and save the new order
    const newOrder = new Order({
      fullName, 
      phoneNumber, 
      wilaya, 
      commune, 
      products
    });
    await newOrder.save();

    // Return success message
    res.status(201).json({ message: 'Order created successfully', order: newOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});



// ✅ Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().populate('products.productId');

    const formattedOrders = orders.map(order => ({
      ...order._doc,
      products: order.products.map(item => ({
        _id: item.productId._id,
        name: item.productId.name,
        price: item.productId.price,
        images: item.productId.images.map(img => `https://sheeka.onrender.com${img}`),
        quantity: item.quantity,
        color: item.color,
        size: item.size
      }))
    }));

    res.status(200).json(formattedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});

// ✅ Get one order
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('products.productId');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const formattedOrder = {
      ...order._doc,
      products: order.products.map(item => ({
        _id: item.productId._id,
        name: item.productId.name,
        price: item.productId.price,
        images: item.productId.images.map(img => `https://sheeka.onrender.com${img}`),
        quantity: item.quantity,
        color: item.color,
        size: item.size
      }))
    };

    res.status(200).json(formattedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
});

// ✅ Update order status (confirmed, cancelled, tentative)
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!['confirmed', 'tentative', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    ).populate('products.productId');

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({ message: 'Order status updated', order: updatedOrder });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
});

module.exports = router;
