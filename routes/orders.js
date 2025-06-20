const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');

// ✅ Create a new order
router.post('/', async (req, res) => {
  try {
    const { fullName, phoneNumber, wilaya, commune, products, status, notes } = req.body; // Added status and notes

    // Ensure all required fields are present
    if (!fullName || !phoneNumber || !wilaya || !commune || !products || products.length === 0) {
      return res.status(400).json({ message: 'All required fields (fullName, phoneNumber, wilaya, commune, and at least one product) are missing.' });
    }

    // Validate phone number format
    const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ message: 'Invalid Algerian phone number format.' });
    }

    // Check if all products exist and validate product details
    for (const item of products) {
      const { productId, quantity, color, size } = item;

      // Check if product ID, quantity, color, and size are provided
      if (!productId || !quantity || !color || !size) {
        return res.status(400).json({ message: 'Product ID, quantity, color, and size are required for each product in the products array.' });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(400).json({ message: `Product with ID ${productId} not found.` });
      }

      if (product.quantity < quantity) {
        return res.status(400).json({ message: `Not enough stock for product: ${product.name}. Available: ${product.quantity}, Requested: ${quantity}.` });
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
      products,
      status: status || 'pending', // Use provided status or default to 'pending'
      notes: notes || '' // Use provided notes or default to empty string
    });
    await newOrder.save();

    // Return success message
    res.status(201).json({ message: 'Order created successfully', order: newOrder });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


// ✅ Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().populate('products.productId');

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'No orders found' });
    }

    const formattedOrders = orders.map(order => {
      return {
        ...order._doc,
        products: order.products.map(item => {
          // Check if productId exists before accessing its properties
          if (item.productId) {
            return {
              _id: item.productId._id,
              name: item.productId.name,
              price: item.productId.price,
              images: item.productId.images ? item.productId.images.map(img => `https://sheeka.onrender.com${img}`) : [],
              quantity: item.quantity,
              color: item.color,
              size: item.size
            };
          } else {
            // Log an error or handle cases where productId might be null/undefined after populate
            console.warn(`Product ID missing for an item in order ${order._id}`);
            return {}; // Return an empty object or a placeholder
          }
        })
      };
    });

    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});


// ✅ Get one order by ID
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('products.productId');
    if (!order) return res.status(404).json({ message: `Order with ID ${req.params.orderId} not found.` });

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
    console.error('Error fetching single order:', error);
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
});

// ✅ Update order status and notes (confirmed, cancelled, tentative)
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body; // Destructure notes from req.body

    const updateFields = {};

    if (status) {
      if (!['pending', 'confirmed', 'tentative', 'cancelled'].includes(status)) { // Include 'pending' for explicit updates
        return res.status(400).json({ message: 'Invalid status value. Allowed: pending, confirmed, tentative, cancelled.' });
      }
      updateFields.status = status;
    }

    // Only update notes if it's explicitly provided in the request body
    // This allows clearing notes by sending an empty string for `notes`
    if (notes !== undefined) {
      updateFields.notes = notes;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update (status or notes).' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updateFields }, // Use $set to update specific fields
      { new: true, runValidators: true } // Return the new document and run schema validators
    ).populate('products.productId');

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    res.status(200).json({ message: 'Order status and/or notes updated', order: updatedOrder });
  } catch (error) {
    console.error('Error updating order status or notes:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// ✅ Update general order details (excluding products for now)
router.patch('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    // Destructure fields that can be updated via this general edit route
    const { fullName, phoneNumber, wilaya, commune, notes } = req.body;

    const updateFields = {};
    if (fullName !== undefined) updateFields.fullName = fullName;
    if (phoneNumber !== undefined) {
      // Validate phone number format if provided
      const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ message: 'Invalid Algerian phone number format.' });
      }
      updateFields.phoneNumber = phoneNumber;
    }
    if (wilaya !== undefined) updateFields.wilaya = wilaya;
    if (commune !== undefined) updateFields.commune = commune;
    if (notes !== undefined) updateFields.notes = notes; // Allow notes to be updated via this route too

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update. Available fields: fullName, phoneNumber, wilaya, commune, notes.' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updateFields }, // Use $set to update specific fields
      { new: true, runValidators: true } // Return the new document and run schema validators
    ).populate('products.productId');

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    res.status(200).json({ message: 'Order updated successfully', order: updatedOrder });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// ✅ Delete an order
router.delete('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Restore product quantities before deleting the order
    for (const item of order.products) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      } else {
        console.warn(`Product with ID ${item.productId} not found during quantity restoration for order ${orderId}. This product might have been deleted previously.`);
      }
    }

    await Order.findByIdAndDelete(orderId);

    res.status(200).json({ message: 'Order deleted successfully.' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

module.exports = router;
