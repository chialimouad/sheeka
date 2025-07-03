// visitorModel.js

// --- Model (In-memory for demonstration) ---
// In a real-world scenario, for persistent daily/monthly/total counts,
// this data would be stored in a persistent database (e.g., Firestore, Redis, MongoDB).
// This simple in-memory counter will reset when the server restarts.

const ACTIVE_THRESHOLD_SECONDS = 30; // Consider a user active if they made a request in the last 30 seconds

// Stores last activity timestamp for each unique user ID (for real-time count)
const lastActivityTimestamps = {}; // { userId: timestampInSeconds }

// Stores unique visitors for the current day (resets daily)
// Key: 'YYYY-MM-DD', Value: Set<userId>
const dailyVisitors = {};

// Stores unique visitors for the current month (resets monthly)
// Key: 'YYYY-MM', Value: Set<userId>
const monthlyVisitors = {};

// Stores all unique visitors ever seen since server started (resets on server restart)
const totalUniqueVisitors = new Set();

// Helper to get current date strings in UTC
function getUtcDateStrings() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
    const day = now.getUTCDate().toString().padStart(2, '0');

    return {
        todayKey: `${year}-${month}-${day}`,
        monthKey: `${year}-${month}`
    };
}

/**
 * Updates the activity timestamp for a given user and records their visit for daily, monthly, and total counts.
 * @param {string} userId - A unique identifier for the user (e.g., client ID from frontend, or IP address).
 */
function recordActivity(userId) {
    const nowInSeconds = Date.now() / 1000;
    lastActivityTimestamps[userId] = nowInSeconds;
    totalUniqueVisitors.add(userId); // Add to overall unique visitors

    const { todayKey, monthKey } = getUtcDateStrings();

    // Ensure dailyVisitors set exists for today
    if (!dailyVisitors[todayKey]) {
        dailyVisitors[todayKey] = new Set();
    }
    dailyVisitors[todayKey].add(userId); // Add to daily unique visitors

    // Ensure monthlyVisitors set exists for this month
    if (!monthlyVisitors[monthKey]) {
        monthlyVisitors[monthKey] = new Set();
    }
    monthlyVisitors[monthKey].add(userId); // Add to monthly unique visitors

    // Optional: Clean up old daily/monthly entries to prevent memory leak
    // In a real app, this would be handled by a scheduled task or database TTL.
    // For this in-memory example, we'll just keep adding.
    // If memory becomes an issue for very long-running servers, a more sophisticated
    // cleanup for dailyVisitors and monthlyVisitors would be needed.
}

/**
 * Removes inactive visitors from the real-time count.
 * This function should be called periodically or on each relevant request.
 */
function cleanupInactiveVisitors() {
    const now = Date.now() / 1000; // Current time in seconds

    // Create a new object to hold only active users for real-time count
    const activeUsers = {};
    for (const userId in lastActivityTimestamps) {
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
}

/**
 * Gets the current count of active visitors (real-time).
 * @returns {number} The number of active visitors.
 */
function getRealtimeVisitorCount() {
    return Object.keys(lastActivityTimestamps).length;
}

/**
 * Gets the count of unique visitors for the current day (UTC).
 * @returns {number} The number of unique visitors today.
 */
function getDailyVisitorCount() {
    const { todayKey } = getUtcDateStrings();
    return dailyVisitors[todayKey] ? dailyVisitors[todayKey].size : 0;
}

/**
 * Gets the count of unique visitors for the current month (UTC).
 * @returns {number} The number of unique visitors this month.
 */
function getMonthlyVisitorCount() {
    const { monthKey } = getUtcDateStrings();
    return monthlyVisitors[monthKey] ? monthlyVisitors[monthKey].size : 0;
}

/**
 * Gets the total count of unique visitors since the server started.
 * @returns {number} The total number of unique visitors.
 */
function getTotalUniqueVisitorCount() {
    return totalUniqueVisitors.size;
}


module.exports = {
    recordActivity,
    cleanupInactiveVisitors,
    getRealtimeVisitorCount, // Renamed for clarity
    getDailyVisitorCount,
    getMonthlyVisitorCount,
    getTotalUniqueVisitorCount,
};
