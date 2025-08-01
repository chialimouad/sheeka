const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Client = require('../models/Client');
const User = require('../models/User');

exports.provisionNewClient = async (req, res) => {
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
        // ✅ Check for existing client by name
        const existingClient = await Client.findOne({ name: clientName });
        if (existingClient) {
            return res.status(400).json({ message: '❌ A client with this name already exists.' });
        }

        // ✅ Check for existing user by email
        const existingUser = await User.findOne({ email: adminEmail });
        if (existingUser) {
            return res.status(400).json({ message: '❌ This admin email is already in use.' });
        }

        // ✅ Generate unique tenantId
        const clientCount = await Client.countDocuments();
        const clientIndex = String(clientCount + 1).padStart(3, '0');
        const sanitizedClientName = clientName.replace(/\s+/g, '').toLowerCase();
        const generatedTenantId = `${sanitizedClientName}${clientIndex}sheeka@mouad`;

        // ✅ Create and save the new client
        const client = new Client({
            name: clientName,
            tenantId: generatedTenantId,
            isActive: true,
            config: {
                jwtSecret: crypto.randomBytes(32).toString('hex'),
                cloudinary: {
                    cloud_name: cloudinaryCloudName,
                    api_key: cloudinaryApiKey,
                    api_secret: cloudinaryApiSecret,
                },
              
            }
        });

        await client.save();

        // ✅ Hash password and create admin user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        const adminUser = new User({
            tenantId: client._id,
            name: 'Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
        });

        await adminUser.save();

        // ✅ Send success response
        return res.status(201).json({
            message: '✅ Client provisioned successfully.',
            client: {
                id: client._id,
                name: client.name,
                tenantId: client.tenantId,
            },
            adminUser: {
                id: adminUser._id,
                email: adminUser.email,
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
