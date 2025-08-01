// models/Client.js

const mongoose = require('mongoose');
const crypto = require('crypto');

// This key should be stored securely as an environment variable (e.g., in a .env file)
// It's used to encrypt and decrypt the sensitive API keys for each client.
const ENCRYPTION_KEY = process.env.CLIENT_CONFIG_ENCRYPTION_KEY || 'default_super_secret_key_for_dev_32_bytes';
const IV_LENGTH = 16; // For AES, this is always 16

// --- Encryption Helper Functions ---

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text || typeof text !== 'string' || !text.includes(':')) {
        return text; // Return text as-is if it's not in the expected encrypted format
    }
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}


// --- Schema Definition ---

const ClientSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Client name is required.'],
    },
    // FIX: Replaced 'subdomain' with 'tenantId' to match the provisioning controller.
    tenantId: {
        type: String,
        required: [true, 'Tenant ID is required.'],
        unique: true,
        lowercase: true,
        index: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    config: {
        jwtSecret: { type: String, required: true },
        cloudinary: {
            cloud_name: { type: String, required: true },
            api_key: { type: String, required: true },
            // The API secret will be encrypted
            api_secret: { type: String, required: true, set: encrypt, get: decrypt },
        },
        // FIX: Changed field names to match the data being sent from the controller.

    }
}, {
    timestamps: true,
    // Ensure that when we get the config, the 'get' functions for decryption are called
    toJSON: { getters: true },
    toObject: { getters: true },
});

module.exports = mongoose.model('Client', ClientSchema);
