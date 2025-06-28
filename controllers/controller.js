
const OrderCount = require('../models/ordercount');

// Controller function to create or update an order count record
exports.createOrderCount = async (req, res) => {
  try {
    // Extract data from the request body
    const { count, timestamp, userId, dateFilter, statusFilter } = req.body;

    // Validate required fields (at least 'count' and 'timestamp' are crucial)
    // For upsert, userId, dateFilter, and statusFilter are crucial for identifying the record.
    if (count === undefined || count === null || !timestamp || !userId || !dateFilter || !statusFilter) {
      return res.status(400).json({ message: 'Count, timestamp, userId, dateFilter, and statusFilter are required for upsert.' });
    }

    // Define the query to find an existing document
    const query = {
      userId: userId,
      dateFilter: dateFilter,
      statusFilter: statusFilter,
    };

    // Define the update operation
    const update = {
      $set: {
        count: count,
        timestamp: new Date(timestamp), // Ensure timestamp is a Date object
      },
      // Optionally, you might want to track the last update time via Mongoose's timestamps option
      // which is already enabled in the schema (updatedAt).
    };

    // Options for findOneAndUpdate:
    // - upsert: true -> Create the document if it doesn't exist
    // - new: true -> Return the modified document rather than the original
    const options = {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true // Applies default values from the schema when creating a new document
    };

    // Find a document matching the query and update it, or create a new one if not found (upsert)
    const updatedOrderCount = await OrderCount.findOneAndUpdate(query, update, options);

    // Determine if it was an insert or update for the response message
    const message = updatedOrderCount.createdAt.getTime() === updatedOrderCount.updatedAt.getTime()
                    ? 'Order count created successfully!'
                    : 'Order count updated successfully!';

    // Send a success response (200 OK for update, 201 Created for insert - findOneAndUpdate typically returns 200)
    res.status(200).json({ // Using 200 for both update/insert via upsert is common for idempotent operations
      message: message,
      orderCount: updatedOrderCount,
    });
  } catch (error) {
    // Handle errors (e.g., database errors, validation errors)
    console.error('Error saving or updating order count:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Optional: Controller function to get all order count records (for demonstration/dashboard)
exports.getTotalOrderCount = async (req, res) => {
  try {
    const count = await OrderCount.countDocuments(); // This directly gets the total count
    res.status(200).json({ count: count }); // Respond with an object containing the count
  } catch (error) {
    console.error('Error fetching total order count:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};