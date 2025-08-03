/**
 * FILE: ./middleware/tenantMiddleware.js
 * DESC: Middleware to resolve tenant information based on the request's hostname.
 * This is the core of the multi-tenant logic.
 */
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant'); // Assuming you have a Tenant model
const User = require('../models/User'); // Assuming a generic User model schema

// A cache to hold tenant-specific database connections
const tenantConnections = {};

const tenantResolver = async (req, res, next) => {
    // Extract subdomain from hostname. e.g., 'acme' from 'acme.yourapp.com'
    const subdomain = req.hostname.split('.')[0];

    // For local development, you might pass a header instead
    // const tenantId = req.headers['x-tenant-id']; 
    
    if (!subdomain) {
        return res.status(400).json({ message: 'Missing tenant identifier.' });
    }

    try {
        // Check if we already have a connection for this tenant in our cache
        if (tenantConnections[subdomain]) {
            console.log(`Using cached DB connection for tenant: ${subdomain}`);
            req.tenantConnection = tenantConnections[subdomain];
            return next();
        }

        // If not cached, find the tenant in the main database
        const tenant = await Tenant.findOne({ subdomain: subdomain });
        
        if (!tenant) {
            return res.status(404).json({ message: `Tenant not found: ${subdomain}` });
        }

        // Create a new database connection for this specific tenant
        console.log(`Creating new DB connection for tenant: ${tenant.name}`);
        const tenantDb = mongoose.createConnection(tenant.dbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Register models on the new tenant-specific connection
        tenantDb.model('User', User.schema);
        // Register other tenant-specific models here...
        // tenantDb.model('Product', require('../models/Product').schema);
        // tenantDb.model('Order', require('../models/Order').schema);

        // Store the connection in our cache for future requests
        tenantConnections[subdomain] = tenantDb;

        // Attach the tenant-specific connection to the request object
        req.tenantConnection = tenantDb;

        // Attach other tenant info, like the JWT secret, to the request
        req.jwtSecret = tenant.jwtSecret;

        next();

    } catch (error) {
        console.error('Tenant resolution error:', error);
        return res.status(500).json({ message: 'Error resolving tenant.' });
    }
};

module.exports = tenantResolver;
