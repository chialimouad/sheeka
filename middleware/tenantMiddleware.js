// middleware/tenantMiddleware.js

const Client = require('../models/Client');

/**
 * @desc    Identifies the client (tenant) based on the request's subdomain.
 * Attaches the client's full document and ID to the request object.
 * @note    This should be the VERY FIRST middleware on any tenant-aware route.
 */
const identifyTenant = async (req, res, next) => {
    try {
        // In production, you would parse the hostname, e.g., 'sheeka.yourapp.com'
        // For development, we can use a custom header like 'x-tenant-id' for easier testing.
        const subdomain = req.headers['x-tenant-subdomain']; // For testing with tools like Postman
        // const hostnameParts = req.hostname.split('.');
        // const subdomain = hostnameParts[0];

        if (!subdomain) {
            return res.status(400).json({ message: 'Unable to identify client. Subdomain or x-tenant-subdomain header is missing.' });
        }

        // Find the client with the matching subdomain.
        const client = await Client.findOne({ subdomain: subdomain.toLowerCase() }).lean();

        if (!client) {
            return res.status(404).json({ message: `Client with subdomain '${subdomain}' not found.` });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // Attach the client's data to the request object for use in subsequent middleware and controllers.
        req.client = client;
        req.tenantId = client._id;

        next();
    } catch (error) {
        console.error('Tenant Identification Error:', error);
        res.status(500).json({ message: 'Server error during client identification.' });
    }
};

module.exports = { identifyTenant };
