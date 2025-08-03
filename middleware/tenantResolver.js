/**
 * FILE: ./middleware/tenantResolver.js
 * DESC: This middleware identifies the tenant based on a custom HTTP header,
 * fetches the tenant's data from the database, and attaches it to the request object.
 * This must run before any routes that depend on a tenant context.
 */
const Client = require('../models/Client'); // Using Client model as per your logic

const tenantResolver = async (req, res, next) => {
    try {
        // The tenant ID is expected in the 'x-tenant-id' header.
        const tenantIdHeader = req.headers['x-tenant-id'];

        if (!tenantIdHeader) {
            return res.status(400).json({ message: 'Tenant ID header (x-tenant-id) is missing.' });
        }

        // Find the client by the unique tenantId.
        const client = await Client.findOne({ tenantId: tenantIdHeader });

        if (!client) {
            return res.status(404).json({ message: 'Client not found for the provided tenant ID.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // Attach client information to the request for use in subsequent middleware/controllers.
        // We create both req.client and req.tenant for compatibility.
        req.client = client;
        req.tenant = client; // For compatibility with authController
        req.tenantId = client.tenantId; // For compatibility with protect middleware

        next();
    } catch (error) {
        console.error('Tenant Identification Error:', error);
        res.status(500).json({ message: 'Server error during client identification.' });
    }
};

module.exports = { tenantResolver };
