// models/Client.js
const mongoose = require('mongoose');

/**
 * @desc Defines the schema for a Client (Tenant).
 */
const clientSchema = new mongoose.Schema({
    tenantId: {
        type: Number,
        required: true,
        unique: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    // **FIX**: Added the email field which is required by the database's unique index.
    // This ensures that the admin's email is saved with the client record.
    email: {
        type: String,
        required: [true, 'Client email is required.'],
        unique: true,
        lowercase: true, // Store emails in lowercase to prevent case-sensitive duplicates
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    config: {
        jwtSecret: {
            type: String,
            required: true,
        },
        cloudinary: {
            cloud_name: String,
            api_key: String,
            api_secret: String,
        },
        nodemailer: {
            user: String,
            pass: String,
        },
    },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields.

module.exports = mongoose.model('Client', clientSchema);
