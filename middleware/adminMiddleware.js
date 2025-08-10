// ==================================================================================
// FILE: ./middleware/adminMiddleware.js
// INSTRUCTIONS: Create this file in your middleware directory.
// ==================================================================================
const isAdmin = (req, res, next) => {
    // This middleware must run AFTER the 'protect' middleware,
    // which attaches the user object to the request.
    if (req.user && req.user.role === 'admin') {
        // If the user is an admin, proceed to the next function.
        next(); 
    } else {
        // If not an admin, send a "Forbidden" error.
        res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
};

module.exports = { isAdmin };
