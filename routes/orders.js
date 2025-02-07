const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');

// ✅ Create a new order
router.post('/', async (req, res) => {
  try {
    const { clientName, phoneNumber, wilaya, commune, products } = req.body;

    if (!clientName || !phoneNumber || !wilaya || !commune || !products.length) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if all products exist
    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ message: `Product with ID ${item.productId} not found` });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for product: ${product.name}` });
      }
      product.quantity -= item.quantity; // Reduce stock
      await product.save();
    }

    const newOrder = new Order({ clientName, phoneNumber, wilaya, commune, products });
    await newOrder.save();

    res.status(201).json({ message: 'Order created successfully', order: newOrder });
  } catch (error) {
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
        quantity: item.quantity
      }))
    }));

    res.status(200).json(formattedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});

// ✅ Get order by ID
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
        quantity: item.quantity
      }))
    };

    res.status(200).json(formattedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
});

module.exports = router;
