const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Client = require('../models/Client'); // Assuming Client model is needed for populating confirmedBy

// Middleware to protect routes and extract client ID (mocked for this example)
// In a real application, you would use a proper JWT verification middleware
const authenticateClient = (req, res, next) => {
  // For demonstration, let's assume a client ID is sent in headers for confirmation
  // In a real app, this would come from a verified JWT token:
  // const token = req.headers.authorization.split(' ')[1];
  // const decodedToken = jwt.verify(token, 'usersecret');
  // req.client = { clientId: decodedToken.clientId };

  // For testing purposes, you can manually set a client ID for an agent
  // Example: req.client = { clientId: 'YOUR_AGENT_CLIENT_ID_HERE' };
  // Or, if using the provided login, the client ID would be available after authentication
  // For this example, we'll assume req.user is populated by some auth middleware
  // Let's create a placeholder for client ID from authentication
  if (req.headers['x-client-id']) { // A simple way to pass client ID for testing
    req.client = { clientId: req.headers['x-client-id'] };
    next();
  } else {
    // If no client ID is provided, it's an unauthenticated request
    // For this demo, we'll allow unauthenticated access but 'confirmedBy' won't be set
    next(); // Proceed, but confirmedBy will not be set for status updates
  }
};

// Apply authentication middleware to routes where confirmation agent is relevant
// router.use(authenticateClient); // Uncomment and implement proper auth for production

// ✅ Create a new order
router.post('/', async (req, res) => {
  try {
    const { fullName, phoneNumber, wilaya, commune, products, status, notes } = req.body;

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
    // Populate both products.productId and confirmedBy fields
    const orders = await Order.find().populate('products.productId').populate('confirmedBy', 'name email');

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
            console.warn(`Product ID missing for an item in order ${order._id}`);
            return {}; // Return an empty object or a placeholder
          }
        }),
        // Include confirmedBy details if populated
        confirmedBy: order.confirmedBy ? {
          _id: order.confirmedBy._id,
          name: order.confirmedBy.name,
          email: order.confirmedBy.email
        } : null
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
    // Populate both products.productId and confirmedBy fields
    const order = await Order.findById(req.params.orderId).populate('products.productId').populate('confirmedBy', 'name email');
    if (!order) return res.status(404).json({ message: `Order with ID ${req.params.orderId} not found.` });

    const formattedOrder = {
      ...order._doc,
      products: order.products.map(item => ({
        _id: item.productId._id,
        name: item.productId.name,
        price: item.productId.price,
        images: item.productId.images ? item.productId.images.map(img => `https://sheeka.onrender.com${img}`) : [],
        quantity: item.quantity,
        color: item.color,
        size: item.size
      })),
      // Include confirmedBy details if populated
      confirmedBy: order.confirmedBy ? {
        _id: order.confirmedBy._id,
        name: order.confirmedBy.name,
        email: order.confirmedBy.email
      } : null
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
    const { status, notes } = req.body;

    const updateFields = {};

    if (status) {
      const allowedStatuses = ['pending', 'confirmed', 'tentative', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value. Allowed: ' + allowedStatuses.join(', ') + '.' });
      }
      updateFields.status = status;

      // Logic for confirmedBy field based on status
      if (status === 'confirmed') {
        // If status is confirmed, set confirmedBy to the authenticated client's ID
        // This assumes req.client.clientId is set by an authentication middleware
        if (req.client && req.client.clientId) {
          updateFields.confirmedBy = req.client.clientId;
        } else {
          // You might want to enforce authentication here if confirmedBy is critical
          console.warn('Attempted to confirm order without authenticated client ID. confirmedBy will not be set.');
        }
      } else {
        // If status is not 'confirmed', clear the confirmedBy field
        updateFields.confirmedBy = null;
      }
    }

    // Only update notes if it's explicitly provided in the request body
    if (notes !== undefined) {
      updateFields.notes = notes;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update (status or notes).' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('products.productId').populate('confirmedBy', 'name email'); // Populate confirmedBy for response

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
    const { fullName, phoneNumber, wilaya, commune, notes } = req.body;

    const updateFields = {};
    if (fullName !== undefined) updateFields.fullName = fullName;
    if (phoneNumber !== undefined) {
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
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('products.productId').populate('confirmedBy', 'name email'); // Populate confirmedBy for response

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
