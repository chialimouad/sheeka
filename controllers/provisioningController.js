// controllers/provisioningController.js

const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Client = require('../models/Client'); // Assuming your client model is here
const User = require('../models/User');     // Assuming your user model is here

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
        // Check if a client with the same name or admin email already exists
        let client = await Client.findOne({ name: clientName });
        if (client) {
            return res.status(400).json({ message: 'A client with this name already exists.' });
        }

        let adminUser = await User.findOne({ email: adminEmail });
         if (adminUser) {
            return res.status(400).json({ message: 'This email is already registered to another user.' });
        }

        // --- NEW: Automatically generate the tenantId ---
        // 1. Get the number of existing clients to create a unique index.
        const clientCount = await Client.countDocuments();
        
        // 2. Format the index to be three digits with leading zeros (e.g., 1 -> "001").
        const clientIndex = String(clientCount + 1).padStart(3, '0');

        // 3. Sanitize the client name (remove spaces, convert to lowercase).
        const sanitizedClientName = clientName.replace(/\s+/g, '').toLowerCase();

        // 4. Construct the final tenantId based on your formula.
        const generatedTenantId = `${sanitizedClientName}${clientIndex}sheeka@mouad`;
        // --- END NEW LOGIC ---

        // --- Create the new Client (Tenant) ---
        client = new Client({
            name: clientName,
            // ADDED: Save the newly generated tenantId to the database.
            tenantId: generatedTenantId, 
            isActive: true,
            config: {
                jwtSecret: crypto.randomBytes(32).toString('hex'),
                cloudinary: {
                    cloud_name: cloudinaryCloudName,
                    api_key: cloudinaryApiKey,
                    api_secret: cloudinaryApiSecret,
                },
            \
            },
        });

        await client.save();

        // --- Create the initial Admin User for this Client ---
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        adminUser = new User({
            tenantId: client._id, 
            name: 'Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
        });

        await adminUser.save();

        res.status(201).json({
            message: 'Client provisioned successfully.',
            client: {
                id: client._id,
                name: client.name,
                // Include the new tenantId in the response
                tenantId: client.tenantId,
            },
            adminUser: {
                id: adminUser._id,
                email: adminUser.email,
            }
        });

    } catch (error) {
        console.error('Provisioning Error:', error.message);
        res.status(500).json({ message: 'Server error during client provisioning.' });
    }
};
