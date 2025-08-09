const crypto = require('crypto');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Client = require('../models/Client');
const User = require('../models/User');
const Counter = require('../models/Counter');

async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findByIdAndUpdate(
        sequenceName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return sequenceDocument.seq;
}

const ProvisioningController = {
    createClient: async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            clientName, subdomain, adminEmail, adminPassword, adminPhoneNumber,
            cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret,
            nodemailerEmail, nodemailerAppPassword
        } = req.body;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
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
                
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ message: `A client with this ${field} already exists.` });
            }

            const nextTenantId = await getNextSequenceValue('tenantId');
            const jwtSecret = crypto.randomBytes(32).toString('hex');

            const newClient = new Client({
                tenantId: nextTenantId,
                name: clientName,
                subdomain: lowerSubdomain,
                email: lowerAdminEmail,
                phoneNumber: adminPhoneNumber,
                config: {
                    jwtSecret,
                    cloudinary: { cloud_name: cloudinaryCloudName, api_key: cloudinaryApiKey, api_secret: cloudinaryApiSecret },
                    nodemailer: { user: nodemailerEmail, pass: nodemailerAppPassword },
                },
            });
            
            const savedClient = await newClient.save({ session });
            
            const adminUser = new User({
                tenantId: savedClient.tenantId,
                name: 'Administrator',
                email: lowerAdminEmail,
                password: adminPassword,
                role: 'admin',
                index: 1 
            });

            await adminUser.save({ session });

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
