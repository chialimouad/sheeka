const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

/**
 * @desc Defines the schema for a Client (Tenant).
 * Each client has a unique, auto-incrementing tenantId.
 */
const clientSchema = new mongoose.Schema({
    // tenantId will be auto-generated and incremented by the plugin, starting from 1001.
    tenantId: {
        type: Number,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true, // It's good practice to keep client names unique as well.
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

// Apply the auto-increment plugin to the tenantId field.
// It will create a counter collection and ensure tenantId is unique and sequential.
clientSchema.plugin(AutoIncrement, { inc_field: 'tenantId', id: 'tenantId_counter', start_seq: 1001 });

module.exports = mongoose.model('Client', clientSchema);
