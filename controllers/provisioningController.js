/**
 * FILE: ./controllers/provisioningController.js
 * DESC: Handles the creation of new Clients (Tenants) and their first admin user.
 *
 * MODIFIED:
 * - Added comprehensive validation to check for existing clients by name, email, phone, or subdomain.
 * - Ensured the rollback mechanism properly deletes a created client if the subsequent admin user creation fails.
 * - Standardized error responses for better client-side handling.
 * - UPDATE: Implemented MongoDB sessions for atomic transactions to ensure that a client and their admin user are either both created or neither is, preventing orphaned data.
 * - FIX: Explicitly set the first admin user's `index` to 1, making them active by default upon creation.
 */
const crypto = require('crypto');
const mongoose = require('mongoose'); // Required for sessions
const { validationResult } = require('express-validator');
const Client = require('../models/Client');
const User = require('../models/User');
const Counter = require('../models/Counter'); // This model is required for atomic ID generation.

/**
 * @desc      Atomically finds and updates a counter sequence to get the next ID.
 * @param     {string} sequenceName The name of the sequence (e.g., 'tenantId').
 * @returns   {Promise<number>} The next unique ID in the sequence.
 */
async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findByIdAndUpdate(
        sequenceName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true } // upsert: true creates the document if it doesn't exist
    );
    return sequenceDocument.seq;
}

const ProvisioningController = {
    /**
     * @desc      Creates a new Client (Tenant) and their initial admin user.
     * @route     POST /api/provision/client
     * @access    Private (Super Admin Only)
     */
    createClient: async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            clientName,
            subdomain,
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
        
        // Start a session for an atomic transaction.
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Check for uniqueness of all critical fields to provide clear error messages.
            const lowerSubdomain = subdomain.toLowerCase();
            const lowerAdminEmail = adminEmail.toLowerCase();

            const existingClient = await Client.findOne({
                $or: [
                    { name: clientName }, 
                    { subdomain: lowerSubdomain },
                    { email: lowerAdminEmail },
                    { phoneNumber: adminPhoneNumber }
                ]
            }).session(session).lean();

            if (existingClient) {
                let field = 'details';
                if (existingClient.name === clientName) field = 'name';
                if (existingClient.subdomain === lowerSubdomain) field = 'subdomain';
                if (existingClient.email === lowerAdminEmail) field = 'email';
                if (existingClient.phoneNumber === adminPhoneNumber) field = 'phone number';
                // Abort transaction before sending response
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ message: `A client with this ${field} already exists.` });
            }

            // 2. Get the next tenantId atomically.
            const nextTenantId = await getNextSequenceValue('tenantId');

            // 3. Generate a unique JWT secret for the tenant.
            const jwtSecret = crypto.randomBytes(32).toString('hex');

            // 4. Create the new Client document within the transaction.
            const newClient = new Client({
                tenantId: nextTenantId,
                name: clientName,
                subdomain: lowerSubdomain, // Save the sanitized subdomain
                email: lowerAdminEmail,
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
            
            const [savedClient] = await newClient.save({ session });
            
            // 5. Create the initial administrator user for the new client within the transaction.
            const adminUser = new User({
                tenantId: savedClient.tenantId,
                name: 'Administrator', // Default name for the first admin
                email: lowerAdminEmail,
                password: adminPassword, // The User model's pre-save hook will handle hashing
                role: 'admin',
                // FIX: Set the first admin user to be active by default.
                index: 1 
            });

            await adminUser.save({ session });

            // If all operations succeed, commit the transaction.
            await session.commitTransaction();

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
            console.error('Failed to provision new client:', error);
            
            // If any error occurs, abort the transaction to roll back all changes.
            await session.abortTransaction();
            
            if (error.code === 11000) { 
                const field = Object.keys(error.keyValue)[0];
                return res.status(409).json({ message: `A user or client with this ${field} already exists.` });
            }

            res.status(500).json({ message: 'Server error during client provisioning.' });
        } finally {
            // Always end the session.
            session.endSession();
        }
    }
};

module.exports = ProvisioningController;
