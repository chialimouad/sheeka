/**
 * FILE: ./controllers/provisioningController.js
 * DESC: Handles the creation of new Clients (Tenants) and their first admin user.
 *
 * MODIFIED:
 * - Integrated the more robust logic for creating clients, including atomic
 * tenant ID generation using a Counter model.
 * - Re-integrated the `subdomain` field, which is received from the form,
 * validated for uniqueness, and saved to the new client document.
 * - Added more detailed validation and error handling, including a rollback
 * mechanism if part of the process fails.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const Client = require('../models/Client');
const User = require('../models/User');
const Counter = require('../models/Counter'); // You must create this model

/**
 * @desc    Atomically finds and updates a counter sequence to get the next ID.
 * @param   {string} sequenceName The name of the sequence (e.g., 'tenantId').
 * @returns {Promise<number>} The next unique ID in the sequence.
 */
async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findByIdAndUpdate(
        sequenceName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return sequenceDocument.seq;
}

const ProvisioningController = {
    /**
     * @desc     Creates a new Client (Tenant) and their initial admin user.
     * @route    POST /api/provision/client
     * @access   Private (Super Admin Only)
     */
    createClient: async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            clientName,
            subdomain, // <-- Field for the unique subdomain
            adminEmail,
            adminPassword,
            adminPhoneNumber,
            cloudinaryCloudName,
            cloudinaryApiKey,
            cloudinaryApiSecret,
            nodemailerEmail,
            nodemailerAppPassword
        } = req.body;

        // --- Validation ---
        if (!clientName || !subdomain || !adminEmail || !adminPassword || !adminPhoneNumber) {
            return res.status(400).json({ message: 'Client name, subdomain, admin email, password, and phone number are required.' });
        }
        
        let savedClient = null;

        try {
            // 1. Check for uniqueness of all critical fields.
            const query = { $or: [
                { name: clientName }, 
                { email: adminEmail.toLowerCase() },
                { phoneNumber: adminPhoneNumber },
                { subdomain: subdomain.toLowerCase() }
            ]};
            const existingClient = await Client.findOne(query);
            if (existingClient) {
                let field = 'details';
                if (existingClient.name === clientName) field = 'name';
                if (existingClient.email === adminEmail.toLowerCase()) field = 'email';
                if (existingClient.phoneNumber === adminPhoneNumber) field = 'phone number';
                if (existingClient.subdomain === subdomain.toLowerCase()) field = 'subdomain';
                return res.status(409).json({ message: `A client with this ${field} already exists.` });
            }

            // 2. Get the next tenantId atomically.
            const nextTenantId = await getNextSequenceValue('tenantId');

            // 3. Generate a unique JWT secret.
            const jwtSecret = crypto.randomBytes(32).toString('hex');

            // 4. Create the new Client document.
            const newClient = new Client({
                tenantId: nextTenantId,
                name: clientName,
                subdomain: subdomain.toLowerCase(), // Save the sanitized subdomain
                email: adminEmail.toLowerCase(),
                phoneNumber: adminPhoneNumber,
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
            
            // 5. Create the initial administrator user for the new client.
            const adminUser = new User({
                tenantId: savedClient.tenantId,
                name: 'Administrator',
                email: adminEmail.toLowerCase(),
                password: adminPassword, // The User model's pre-save hook should handle hashing
                role: 'admin',
            });

            await adminUser.save();

            res.status(201).json({
                message: 'Client provisioned successfully!',
                client: {
                    id: savedClient._id,
                    tenantId: savedClient.tenantId,
                    name: savedClient.name,
                    subdomain: savedClient.subdomain,
                }
            });

        } catch (error) {
            console.error('Failed to provision new client:', error.message);

            // If the client was saved but user creation failed, roll back.
            if (savedClient) {
                await Client.findByIdAndDelete(savedClient._id);
            }
            
            if (error.code === 11000) { 
                const field = Object.keys(error.keyValue)[0];
                return res.status(409).json({ message: `A client with this ${field} already exists.` });
            }

            res.status(500).json({ message: 'Server error during client provisioning.' });
        }
    }
};

module.exports = ProvisioningController;
