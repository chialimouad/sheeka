// middleware/superAdminMiddleware.js

/**
 * @desc     Protects the client provisioning route.
 * Ensures that only a request with the master API key can create new tenants.
 * NOTE: The API key is hardcoded for now. In production, use an environment variable.
 */

const isSuperAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    // ✅ Hardcoded Super Admin Key — replace with env in production
    const superAdminKey = 'mouadchiali2231421ans';

    if (!apiKey) {
        return res.status(401).json({ message: 'Unauthorized: API key missing.' });
    }

    if (apiKey !== superAdminKey) {
        return res.status(403).json({ message: 'Forbidden: Invalid API key.' });
    }

    // ✅ API key is correct, allow request to continue
    next();
};

module.exports = { isSuperAdmin };
