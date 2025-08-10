const crypto = require('crypto');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Client = require('../models/Client');
const User = require('../models/User');
const Counter = require('../models/Counter');

/**
 * Generates the next sequential number for a given counter (e.g., 'tenantId').
 * @param {string} sequenceName The name of the sequence to increment.
 * @returns {Promise<number>} The next sequence value.
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
     * @desc    Provision a new client with a tenantId, configuration, and an initial admin user.
     * @route   POST /api/provision/client
     * @access  SuperAdmin
     */
    createClient: async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            clientName, subdomain, adminEmail, adminPassword, adminPhoneNumber,
            cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret
        } = req.body;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const lowerSubdomain = subdomain.toLowerCase();
            const lowerAdminEmail = adminEmail.toLowerCase();

            // Check for existing client with the same unique details
            const existingClient = await Client.findOne({
                $or: [
                    { name: clientName },
                    { subdomain: lowerSubdomain },
                    { email: lowerAdminEmail }
                ]
            }).session(session).lean();

            if (existingClient) {
                let field = 'details';
                if (existingClient.name === clientName) field = 'name';
                if (existingClient.subdomain === lowerSubdomain) field = 'subdomain';
                if (existingClient.email === lowerAdminEmail) field = 'email';
                
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ message: `A client with this ${field} already exists.` });
            }

            // Generate a unique, sequential tenantId and a secure JWT secret
            const nextTenantId = await getNextSequenceValue('tenantId');
            const jwtSecret = crypto.randomBytes(32).toString('hex');

            // Create new Client document
            const newClient = new Client({
                tenantId: nextTenantId,
                name: clientName,
                subdomain: lowerSubdomain,
                email: lowerAdminEmail,
                phoneNumber: adminPhoneNumber,
                config: {
                    jwtSecret,
                    cloudinary: { cloud_name: cloudinaryCloudName, api_key: cloudinaryApiKey, api_secret: cloudinaryApiSecret },
                },
            });
            
            const savedClient = await newClient.save({ session });
            
            // Create the initial Administrator user for this new client
            const adminUser = new User({
                tenantId: savedClient.tenantId,
                name: 'Administrator', // Default name for the first admin
                email: lowerAdminEmail,
                password: adminPassword, // Password will be hashed by the pre-save hook in the User model
                role: 'admin',
                index: 1 // Active by default
            });

            await adminUser.save({ session });

            // If all operations succeed, commit the transaction
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
            await session.abortTransaction();
            
            // Handle potential race conditions or unique index violations
            if (error.code === 11000) { 
                const field = Object.keys(error.keyValue)[0];
                return res.status(409).json({ message: `A user or client with this ${field} already exists.` });
            }

            res.status(500).json({ message: 'Server error during client provisioning.' });
        } finally {
            session.endSession();
        }
    }
};

module.exports = ProvisioningController;
