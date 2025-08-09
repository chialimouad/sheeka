// ==================================================================================
// FILE: ./middleware/adminMiddleware.js
// INSTRUCTIONS: Create this new file in your middleware directory.
// This middleware checks if the logged-in user has the 'admin' role.
// ==================================================================================
const isAdmin = (req, res, next) => {
    // This middleware should run AFTER the 'protect' middleware,
    // which attaches the user object to the request (e.g., req.user).
    if (req.user && req.user.role === 'admin') {
        // If the user exists and their role is 'admin', proceed.
        next(); 
    } else {
        // Otherwise, deny access.
        res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
};

module.exports = { isAdmin };
