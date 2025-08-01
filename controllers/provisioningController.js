// controllers/provisioningController.js

const Client = require('../models/Client');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

/**
 * @desc     Creates a new client instance (tenant) with its configuration and initial admin user.
 * @route    POST /api/provision/client
 * @access   Private (Super Admin Only)
 */
exports.provisionNewClient = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        clientName,
        subdomain,
        adminEmail,
        adminPassword,
        cloudinaryCloudName,
        cloudinaryApiKey,
        cloudinaryApiSecret,
        nodemailerEmail,
        nodemailerAppPassword
    } = req.body;

    try {
        // 1. Check if the subdomain is already in use to prevent duplicates.
        const existingClient = await Client.findOne({ subdomain: subdomain.toLowerCase() });
        if (existingClient) {
            return res.status(409).json({ message: `Subdomain '${subdomain}' is already in use.` });
        }

        // 2. Generate a unique and secure JWT secret for the new client.
        // This is a standard and secure way to create a secret key for signing tokens.
        const jwtSecret = crypto.randomBytes(32).toString('hex');

        // 3. Create the new Client document with all their configuration.
        const newClient = new Client({
            name: clientName,
            subdomain: subdomain.toLowerCase(),
            config: {
                jwtSecret, // Store the new secret for this client
                cloudinary: {
                    cloud_name: cloudinaryCloudName,
                    api_key: cloudinaryApiKey,
                    api_secret: cloudinaryApiSecret,
                },
                nodemailer: {
                    user: nodemailerEmail,
                    pass: nodemailerAppPassword,
                },
            },
        });

        const savedClient = await newClient.save();
        const tenantId = savedClient._id;

        // 4. Create the initial administrator user for this new client.
        const adminUser = new User({
            tenantId, // Link the admin to the new client
            name: 'Administrator', // Default name for the first admin
            email: adminEmail.toLowerCase(),
            password: adminPassword, // The password will be hashed by the User model's pre-save hook
            role: 'admin',
        });

        await adminUser.save();

        console.log(`Successfully provisioned new client: ${clientName} (${tenantId})`);

        res.status(201).json({
            message: 'Client provisioned successfully!',
            client: {
                id: savedClient._id,
                name: savedClient.name,
                subdomain: savedClient.subdomain,
            }
        });

    } catch (error) {
        console.error('CRITICAL: Failed to provision new client:', error);
        // In a production system, you might add logic here to roll back the client creation if the admin user fails to save.
        res.status(500).json({ message: 'Server error during client provisioning.' });
    }
};
