const OrderCount = require('../models/ordercount'); // Ensure your OrderCount model is correctly defined

/**
 * @desc Creates a new order count record or updates an existing one (upsert).
 * @route POST /api/ordercounts
 * @access Private (e.g., requires authentication)
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.createOrderCount = async (req, res) => {
    try {
        // Extract data from the request body
        const { count, timestamp, userId, dateFilter, statusFilter } = req.body;

        // --- Input Validation ---
        // Ensure all critical fields for identifying and updating/creating the record are present.
        if (count === undefined || count === null || !timestamp || !userId || !dateFilter || !statusFilter) {
            return res.status(400).json({ message: 'Missing required fields: count, timestamp, userId, dateFilter, and statusFilter are all necessary.' });
        }

        // Validate 'count' to be a non-negative number
        if (typeof count !== 'number' || count < 0) {
            return res.status(400).json({ message: 'Count must be a non-negative number.' });
        }

        // Validate 'timestamp' to be a valid date string or number
        const parsedTimestamp = new Date(timestamp);
        if (isNaN(parsedTimestamp.getTime())) {
            return res.status(400).json({ message: 'Invalid timestamp provided.' });
        }

        // Define the query to find an existing document.
        // These fields should ideally be indexed in your OrderCount Mongoose schema for performance.
        const query = {
            userId: userId,
            dateFilter: dateFilter,
            statusFilter: statusFilter,
        };

        // Define the update operation.
        // $set ensures that only these fields are updated, or set if new.
        const update = {
            $set: {
                count: count,
                timestamp: parsedTimestamp, // Use the validated and parsed Date object
            },
            // Mongoose's timestamps option (if enabled in schema) will handle `updatedAt`.
        };

        // Options for findOneAndUpdate:
        // - upsert: true -> Create the document if it doesn't exist.
        // - new: true -> Return the modified document rather than the original.
        // - setDefaultsOnInsert: true -> Applies default values from the schema when creating a new document.
        const options = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            runValidators: true // Run schema validators on the update operation
        };

        // Find a document matching the query and update it, or create a new one if not found (upsert)
        const updatedOrderCount = await OrderCount.findOneAndUpdate(query, update, options);

        // Determine if it was an insert or update for the response message
        // This check relies on `createdAt` and `updatedAt` being set by Mongoose timestamps.
        const message = updatedOrderCount.createdAt.getTime() === updatedOrderCount.updatedAt.getTime()
            ? 'Order count record created successfully!'
            : 'Order count record updated successfully!';

        // Send a success response. Using 200 OK for both update/insert via upsert is common for idempotent operations.
        res.status(200).json({
            message: message,
            orderCount: updatedOrderCount,
        });

    } catch (error) {
        // Handle errors (e.g., database errors, validation errors)
        console.error('Error in createOrderCount:', error.message);
        // Provide a generic error message to the client for security
        res.status(500).json({ message: 'Server error while processing order count. Please try again.' });
    }
};

/**
 * @desc Get all order count records.
 * @route GET /api/ordercounts
 * @access Private (e.g., Admin access or for specific user's own data)
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.getAllOrderCounts = async (req, res) => {
    try {
        // Fetch all order counts and sort them by timestamp in descending order (newest first).
        // For very large datasets, consider pagination (e.g., using skip and limit).
        const orderCounts = await OrderCount.find().sort({ timestamp: -1 });
        res.status(200).json(orderCounts);
    } catch (error) {
        console.error('Error in getAllOrderCounts:', error.message);
        // Provide a generic error message to the client for security
        res.status(500).json({ message: 'Server error while fetching order counts. Please try again.' });
    }
};
