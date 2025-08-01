// middleware/superAdminMiddleware.js

/**
 * @desc     Protects the client provisioning route.
 * Ensures that only a request with the master API key can create new tenants.
 * NOTE: The API key is hardcoded as requested. The standard, more secure practice
 * is to store this in an environment variable (.env file).
 */
const isSuperAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    // The Super Admin API Key is now hardcoded directly into the file.
    const superAdminKey = 'mouadchiali2231421ans';

    if (apiKey && apiKey === superAdminKey) {
        next(); // The provided API key is correct, proceed to the next step.
    } else {
        // The API key is missing or incorrect, send a "Forbidden" error.
        res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
    }
};

module.exports = { isSuperAdmin };
