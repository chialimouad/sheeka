const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Client = require('../models/Client');
const User = require('../models/User');

exports.provisionNewClient = async (req, res) => {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        clientName,
        adminEmail,
        adminPassword,
        cloudinaryCloudName,
        cloudinaryApiKey,
        cloudinaryApiSecret,
    } = req.body;

    try {
        // Check if client already exists
        const existingClient = await Client.findOne({ name: clientName });
        if (existingClient) {
            return res.status(400).json({ message: '❌ A client with this name already exists.' });
        }

        // Check if user with the same email already exists
        const existingUser = await User.findOne({ email: adminEmail });
        if (existingUser) {
            return res.status(400).json({ message: '❌ This admin email is already in use.' });
        }

        // Generate a tenantId
        const clientCount = await Client.countDocuments();
        const clientIndex = String(clientCount + 1).padStart(3, '0');
        const sanitizedClientName = clientName.replace(/\s+/g, '').toLowerCase();
        const generatedTenantId = `${sanitizedClientName}${clientIndex}@sheeka`;

        // Create and save new client
        const newClient = new Client({
            name: clientName,
            tenantId: generatedTenantId,
            isActive: true,
            config: {
                jwtSecret: crypto.randomBytes(32).toString('hex'),
                cloudinary: {
                    cloud_name: cloudinaryCloudName,
                    api_key: cloudinaryApiKey,
                    api_secret: cloudinaryApiSecret,
                }
            }
        });

        await newClient.save();

        // Hash password and create admin user
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const newAdminUser = new User({
            tenantId: newClient._id,
            name: 'Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin'
        });

        await newAdminUser.save();

        // Respond with success
        return res.status(201).json({
            message: '✅ Client provisioned successfully.',
            client: {
                id: newClient._id,
                name: newClient.name,
                tenantId: newClient.tenantId,
            },
            adminUser: {
                id: newAdminUser._id,
                email: newAdminUser.email,
            }
        });

    } catch (error) {
        console.error('❌ Provisioning Error:', error);
        return res.status(500).json({
            message: 'Server error during client provisioning.',
            error: error.message
        });
    }
};
