const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Client = require('../models/Client');
const User = require('../models/User');

exports.provisionNewClient = async (req, res) => {
    // Step 1: Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
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
        // Step 2: Ensure client name and email are unique
        const [existingClient, existingUser] = await Promise.all([
            Client.findOne({ name: clientName }),
            User.findOne({ email: adminEmail }),
        ]);

        if (existingClient) {
            return res.status(409).json({ message: '❌ A client with this name already exists.' });
        }

        if (existingUser) {
            return res.status(409).json({ message: '❌ This admin email is already in use.' });
        }

        // Step 3: Generate a unique tenantId
        const clientCount = await Client.countDocuments();
        const clientIndex = String(clientCount + 1).padStart(3, '0');
        const sanitizedClientName = clientName.replace(/\s+/g, '').toLowerCase();
        const tenantId = `${sanitizedClientName}${clientIndex}@sheeka`;

        // Step 4: Create the client record
        const jwtSecret = crypto.randomBytes(32).toString('hex');
        const newClient = new Client({
            name: clientName,
            tenantId,
            isActive: true,
            config: {
                jwtSecret,
                cloudinary: {
                    cloud_name: cloudinaryCloudName,
                    api_key: cloudinaryApiKey,
                    api_secret: cloudinaryApiSecret,
                },
            },
        });

        await newClient.save();

        // Step 5: Hash password and create the admin user
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const newAdminUser = new User({
            tenantId: newClient.tenantId, // 🛠️ Correct: Use tenantId string, not _id
            name: 'Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
        });

        await newAdminUser.save();

        // Step 6: Respond
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
            message: '❌ Server error during client provisioning.',
            error: error.message
        });
    }
};
