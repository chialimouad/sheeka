// middleware/tenantMiddleware.js

const Client = require('../models/Client');

/**
 * @desc    Identifies the client (tenant) based on a tenant ID header.
 * Attaches the client's full document and ID to the request object.
 */
const identifyTenant = async (req, res, next) => {
    try {
        // Use x-tenant-id header instead of subdomain
        const tenantId = req.headers['x-tenant-id'];

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID (x-tenant-id) is missing from the headers.' });
        }

        // Find the client using the tenantId (could be _id or a custom field)
        const client = await Client.findById(tenantId).lean();

        if (!client) {
            return res.status(404).json({ message: 'Client not found.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // Attach client info to request
        req.client = client;
        req.tenantId = client._id;

        next();
    } catch (error) {
        console.error('Tenant Identification Error:', error);
        res.status(500).json({ message: 'Server error during client identification.' });
    }
};

module.exports = { identifyTenant };
