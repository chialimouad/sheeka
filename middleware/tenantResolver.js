/**
 * FILE: ./middleware/tenantResolver.js
 * DESC: This middleware identifies the tenant based on a custom HTTP header,
 * fetches the tenant's data from the database, and attaches it to the request object.
 *
 * MODIFIED: Now correctly attaches the jwtSecret from the client record to the
 * request object as req.jwtSecret, which is required by the login controller.
 */
const Client = require('../models/Client'); // Using Client model as per your logic

const tenantResolver = async (req, res, next) => {
    try {
        const tenantIdHeader = req.headers['x-tenant-id'];

        if (!tenantIdHeader) {
            return res.status(400).json({ message: 'Tenant ID header (x-tenant-id) is missing.' });
        }

        const client = await Client.findOne({ tenantId: tenantIdHeader });

        if (!client) {
            return res.status(404).json({ message: 'Client not found for the provided tenant ID.' });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: 'This client account is inactive.' });
        }

        // Attach client information to the request for use in subsequent middleware/controllers.
        req.client = client;
        req.tenant = client; 
        req.tenantId = client.tenantId;
        
        // --- THIS IS THE FIX ---
        // The login controller expects req.jwtSecret to be available directly.
        req.jwtSecret = client.jwtSecret;

        next();
    } catch (error) {
        console.error('Tenant Identification Error:', error);
        res.status(500).json({ message: 'Server error during client identification.' });
    }
};

module.exports = { tenantResolver };
