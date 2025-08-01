/**
 * @desc Middleware to protect super admin routes using an API key.
 * Uses environment variable SUPER_ADMIN_KEY for security.
 */

const isSuperAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    // Use environment variable in production
    const superAdminKey = process.env.SUPER_ADMIN_KEY;

    if (!apiKey) {
        console.warn('❌ API key missing in request headers.');
        return res.status(401).json({ message: 'Unauthorized: API key is missing.' });
    }

    if (apiKey !== superAdminKey) {
        console.warn('❌ Invalid API key used.');
        return res.status(403).json({ message: 'Forbidden: Invalid API key.' });
    }

    // ✅ API key is valid
    next();
};

module.exports = { isSuperAdmin };
