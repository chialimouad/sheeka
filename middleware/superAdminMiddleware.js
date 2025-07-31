// middleware/superAdminMiddleware.js

/**
 * @desc    Protects the client provisioning route.
 * Ensures that only a request with the master SUPER_ADMIN_API_KEY can create new tenants.
 */
const isSuperAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const superAdminKey = process.env.SUPER_ADMIN_API_KEY;

    if (!superAdminKey) {
        console.error('CRITICAL: SUPER_ADMIN_API_KEY is not set in the environment variables.');
        return res.status(500).json({ message: 'Server configuration error.' });
    }

    if (apiKey && apiKey === superAdminKey) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
    }
};

module.exports = { isSuperAdmin };
