// controllers/provisioningController.js

const Client = require('../models/Client');
const User = require('../models/User');
const Counter = require('../models/Counter'); // Import the new Counter model
const crypto = require('crypto');
const { validationResult } = require('express-validator');

/**
 * @desc    Atomically finds and updates a counter sequence to get the next ID.
 * This prevents race conditions when creating new clients.
 * @param   {string} sequenceName The name of the sequence (e.g., 'tenantId').
 * @returns {Promise<number>} The next unique ID in the sequence.
 */
async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findByIdAndUpdate(
        sequenceName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true } // `new: true` returns the updated doc, `upsert: true` creates it if it doesn't exist
    );
    return sequenceDocument.seq;
}


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
        adminEmail,
        adminPassword,
        cloudinaryCloudName,
        cloudinaryApiKey,
        cloudinaryApiSecret,
        nodemailerEmail,
        nodemailerAppPassword
    } = req.body;

    let savedClient = null; // Keep track of the saved client for potential rollback

    try {
        // 1. Check if the client name is already in use.
        const existingClient = await Client.findOne({ name: clientName });
        if (existingClient) {
            return res.status(409).json({ message: `Client name '${clientName}' is already in use.` });
        }

        // 2. **FIXED**: Get the next tenantId atomically from the counter.
        const nextTenantId = await getNextSequenceValue('tenantId');

        // 3. Generate a unique JWT secret for the new client.
        const jwtSecret = crypto.randomBytes(32).toString('hex');

        // 4. Create the new Client document.
        const newClient = new Client({
            tenantId: nextTenantId, // Use the new atomic ID
            name: clientName,
            config: {
                jwtSecret,
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
        
        savedClient = await newClient.save();
        const tenantId = savedClient.tenantId;

        // 5. Create the initial administrator user for this new client.
        const adminUser = new User({
            tenantId, // This will be the new, unique number.
            name: 'Administrator',
            email: adminEmail.toLowerCase(),
            password: adminPassword,
            role: 'admin',
        });

        await adminUser.save();

        res.status(201).json({
            message: 'Client provisioned successfully!',
            client: {
                id: savedClient._id,
                tenantId: savedClient.tenantId,
                name: savedClient.name,
            }
        });

    } catch (error) {
        console.error('Failed to provision new client:', error.message);

        // If client was created but user failed, delete the client to avoid orphaned data.
        if (savedClient) {
            await Client.findByIdAndDelete(savedClient._id);
        }
        
        if (error.code === 11000) { 
             return res.status(409).json({ message: 'A client with this name was just created. Please try again.' });
        }

        res.status(500).json({ message: 'Server error during client provisioning.' });
    }
};
