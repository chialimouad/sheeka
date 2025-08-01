const Client = require('../models/Client');

/**
 * @desc Identifies the client (tenant) based on the 'x-tenant-id' header.
 * Attaches the client's full document and tenantId to the request object.
 */
const identifyTenant = async (req, res, next) => {
    try {
        // The tenant ID is expected in the 'x-tenant-id' header.
        const tenantId = req.headers['x-tenant-id'];

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID header (x-tenant-id) is missing.' });
        }

        // Find the client by the unique numeric tenantId.
        const client = await Client.findOne({ tenantId: tenantId }).lean();

        if (!client) {
            return res.status(404).json({ message: 'Client not found for the provided tenant ID.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // Attach client information to the request for use in subsequent middleware and controllers.
        req.client = client;
        req.tenantId = client.tenantId;

        next();
    } catch (error) {
        console.error('Tenant Identification Error:', error);
        res.status(500).json({ message: 'Server error during client identification.' });
    }
};

module.exports = { identifyTenant };
