// visitorController.js
const visitorModel = require('../models/visit'); // Import the model

/**
 * Handles GET requests to get various real-time and historical counts of visitors.
 * It updates user activity and returns the current visitor count, daily, monthly, and total unique visitors.
 */
function getVisitorStats(req, res) {
    // Prioritize the unique client ID sent from the frontend.
    // This allows for more accurate tracking of individual browser sessions,
    // even if the user's IP address changes (e.g., on mobile networks).
    // If no client ID is provided, fall back to the IP address.
    const userId = req.headers['x-client-id'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Optional: Log if no identifiable ID is found.
    if (!userId) {
        console.warn('No identifiable user ID (X-Client-ID or IP) found for a visitor request. Cannot track unique visitor.');
        // Still return the current count, but indicate a tracking issue.
        return res.status(400).json({
            realtimeCount: visitorModel.getRealtimeVisitorCount(), // Return real-time even on error
            dailyCount: visitorModel.getDailyVisitorCount(),
            monthlyCount: visitorModel.getMonthlyVisitorCount(),
            totalCount: visitorModel.getTotalUniqueVisitorCount(),
            message: "Could not identify client for tracking this request. Counts may be incomplete."
        });
    }

    // Record the activity for the current user (identified by client ID or IP)
    visitorModel.recordActivity(userId);

    // Clean up inactive users and recount active visitors
    // This is crucial for "discounting" users who have left or become inactive.
    visitorModel.cleanupInactiveVisitors();

    // Get all the current visitor counts from the model
    const realtimeCount = visitorModel.getRealtimeVisitorCount();
    const dailyCount = visitorModel.getDailyVisitorCount();
    const monthlyCount = visitorModel.getMonthlyVisitorCount();
    const totalCount = visitorModel.getTotalUniqueVisitorCount();

    // Return the response as JSON with all metrics
    res.json({
        realtimeCount: realtimeCount,
        dailyCount: dailyCount,
        monthlyCount: monthlyCount,
        totalCount: totalCount,
        message: "Current active, daily, monthly, and total unique visitors."
    });
}

module.exports = {
    getVisitorStats // Renamed the export for clarity
};
