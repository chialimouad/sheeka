// models/Client.js
const mongoose = require('mongoose');

/**
 * @desc Defines the schema for a Client (Tenant).
 * This version removes the 'subdomain' field to align with the login-by-ID approach.
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
    email: {
        type: String,
        required: [true, 'Client email is required.'],
        unique: true,
        lowercase: true, 
        trim: true,
    },
    phoneNumber: {
        type: String,
        required: [true, 'Client phone number is required.'],
        unique: true,
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
