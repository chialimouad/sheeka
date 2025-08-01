// middleware/superAdminMiddleware.js

/**
 * @desc Protects the client provisioning route.
 * Only allows requests with the Super Admin API key.
 * NOTE: Replace the hardcoded API key with an environment variable for production use.
 */

const isSuperAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    // ✅ Replace this with: process.env.SUPER_ADMIN_KEY in production
    const superAdminKey = 'mouadchiali2231421ans';

    if (!apiKey) {
        return res.status(401).json({ message: 'Unauthorized: API key missing.' });
    }

    if (apiKey !== superAdminKey) {
        return res.status(403).json({ message: 'Forbidden: Invalid API key.' });
    }

    next(); // ✅ API key is valid, continue to the next middleware or route
};

module.exports = { isSuperAdmin };
