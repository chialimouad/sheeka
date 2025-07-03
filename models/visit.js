// visitorModel.js

// --- Model (In-memory for demonstration) ---
// In a real-world scenario, this would be stored in a persistent database
// like Redis (for speed) or a more traditional database (PostgreSQL, MongoDB).
// This simple counter resets when the server restarts.
let currentVisitors = 0;
const lastActivityTimestamps = {}; // To track active users based on last request time

// Configuration for visitor tracking
const ACTIVE_THRESHOLD_SECONDS = 30; // Consider a user active if they made a request in the last 30 seconds

/**
 * Updates the activity timestamp for a given user.
 * @param {string} userId - A unique identifier for the user (e.g., IP address).
 */
function recordActivity(userId) {
    lastActivityTimestamps[userId] = Date.now() / 1000; // Convert milliseconds to seconds
}

/**
 * Removes inactive visitors and updates the global count.
 * This function should be called periodically or on each relevant request.
 */
function cleanupInactiveVisitors() {
    const now = Date.now() / 1000; // Current time in seconds
    
    // Create a new object to hold only active users
    const activeUsers = {};
    for (const userId in lastActivityTimestamps) {
        // If the user's last activity is within the threshold, keep them
        if ((now - lastActivityTimestamps[userId]) <= ACTIVE_THRESHOLD_SECONDS) {
            activeUsers[userId] = lastActivityTimestamps[userId];
        }
    }
    
    // Update the original lastActivityTimestamps object to reflect only active users
    // This clears out inactive users while preserving active ones
    for (const key in lastActivityTimestamps) {
        if (!(key in activeUsers)) {
            delete lastActivityTimestamps[key];
        }
    }
    Object.assign(lastActivityTimestamps, activeUsers);

    // Update the global currentVisitors count
    currentVisitors = Object.keys(lastActivityTimestamps).length;
}

/**
 * Gets the current count of active visitors.
 * @returns {number} The number of active visitors.
 */
function getVisitorCount() {
    return currentVisitors;
}

module.exports = {
    recordActivity,
    cleanupInactiveVisitors,
    getVisitorCount
};
