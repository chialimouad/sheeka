const mongoose = require('mongoose');

/**
 * @desc Defines the schema for a Client (Tenant).
 * The tenantId is now manually generated in the controller.
 */
const clientSchema = new mongoose.Schema({
    tenantId: {
        type: Number,
        required: true, // It's now required as we set it manually.
        unique: true,
        index: true, // Add an index for faster lookups.
    },
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
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
