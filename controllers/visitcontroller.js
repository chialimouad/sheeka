// visitorController.js
const visitorModel = require('../models/visit'); // Import the model

/**
 * Handles GET requests to get the real-time count of visitors.
 * It updates user activity and returns the current visitor count.
 */
function getRealtimeVisitors(req, res) {
    // Get the user's IP address.
    // 'x-forwarded-for' is used when behind a proxy (like a load balancer or CDN).
    // req.socket.remoteAddress is the direct client IP if no proxy, or the proxy's IP.
    // By prioritizing these, we count based on IP.
    const userId = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Optional: Log if no IP is found, though it should almost always be present.
    if (!userId) {
        console.warn('No IP address found for a visitor request. Cannot track unique visitor.');
        // You might choose to return an error or a default count here,
        // but for real-time tracking, an identifiable ID is crucial.
        return res.status(400).json({
            count: visitorModel.getVisitorCount(), // Still return current count
            message: "Could not identify client IP for tracking this request."
        });
    }

    // Record the activity for the current user (identified by IP)
    visitorModel.recordActivity(userId);

    // Clean up inactive users and recount active visitors
    visitorModel.cleanupInactiveVisitors();

    // Get the current active visitor count from the model
    const count = visitorModel.getVisitorCount();

    // Return the response as JSON
    res.json({
        count: count,
        message: "Current active visitors on the site based on IP addresses."
    });
}

module.exports = {
    getRealtimeVisitors
};
