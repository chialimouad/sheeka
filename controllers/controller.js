
const OrderCount = require('../models/ordercount');

// Controller function to create a new order count record
exports.createOrderCount = async (req, res) => {
  try {
    // Extract data from the request body
    const { count, timestamp, userId, dateFilter, statusFilter } = req.body;

    // Validate required fields (at least 'count' and 'timestamp' are crucial)
    if (count === undefined || count === null || !timestamp) {
      return res.status(400).json({ message: 'Count and timestamp are required' });
    }

    // Create a new OrderCount instance
    const newOrderCount = new OrderCount({
      count,
      timestamp: new Date(timestamp), // Ensure timestamp is a Date object
      userId,
      dateFilter,
      statusFilter,
    });

    // Save the new order count record to the database
    const savedOrderCount = await newOrderCount.save();

    // Send a success response
    res.status(201).json({
      message: 'Order count saved successfully!',
      orderCount: savedOrderCount,
    });
  } catch (error) {
    // Handle errors (e.g., database errors, validation errors)
    console.error('Error saving order count:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Optional: Controller function to get all order count records (for demonstration/dashboard)
exports.getAllOrderCounts = async (req, res) => {
  try {
    const orderCounts = await OrderCount.find().sort({ timestamp: -1 }); // Sort by newest first
    res.status(200).json(orderCounts);
  } catch (error) {
    console.error('Error fetching order counts:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};