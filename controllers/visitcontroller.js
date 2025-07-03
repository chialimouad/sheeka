// visitorController.js
const visitorModel = require('../models/visit'); // Import the model

/**
 * Handles GET requests to get the real-time count of visitors.
 * It updates user activity, cleans up inactive users, and returns the current count.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
function getRealtimeVisitors(req, res) {
    // Get a unique identifier for the user.
    // req.headers['x-forwarded-for'] is preferred for production behind proxies.
    // req.socket.remoteAddress is a fallback for direct connections.
    const userId = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Record the activity for the current user
    visitorModel.recordActivity(userId);

    // Clean up inactive users and recount active visitors
    visitorModel.cleanupInactiveVisitors();

    // Get the current active visitor count from the model
    const count = visitorModel.getVisitorCount();

    // Return the response as JSON
    res.json({
        count: count,
        message: "Current active visitors on the site."
    });
}

module.exports = {
    getRealtimeVisitors
};
