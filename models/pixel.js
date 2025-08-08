// models/Pixel.js

const mongoose = require('mongoose');

const PixelSchema = new mongoose.Schema({
    // This tenantId field is the core of the multi-tenant architecture. It ensures
    // that each pixel configuration is securely tied to a specific client.
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'A tenant ID is required for every pixel configuration.'],
        ref: 'Client', // Assumes you have a 'Client' or 'Tenant' model
        index: true,   // Indexing this field is crucial for fast lookups in a multi-tenant DB.
    },
    fbPixelId: {
        type: String,
        trim: true,
    },
    tiktokPixelId: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// --- Tenant-Aware Static Methods ---
// These methods ensure that all database operations are scoped to a specific tenant,
// preventing data leaks between clients.

/**
 * Retrieves the latest pixel configuration for a specific tenant.
 * @param {string} tenantId - The ID of the tenant.
 * @returns {object|null} An object with facebookPixelId and tiktokPixelId, or null if none found.
 */
PixelSchema.statics.getLatestPixelConfigForTenant = async function (tenantId) {
    const latestPixel = await this.findOne({ tenantId }).sort({ createdAt: -1 }).lean();
    if (latestPixel) {
        return {
            facebookPixelId: latestPixel.fbPixelId,
            tiktokPixelId: latestPixel.tiktokPixelId
        };
    }
    return null; // Return null to indicate no config was found
};

/**
 * Creates a new pixel entry for a specific tenant.
 * @param {object} data - Object containing fbPixelId, tiktokPixelId, and tenantId.
 * @returns {Promise<object>} The newly created pixel document.
 */
PixelSchema.statics.createPixelForTenant = async function (data) {
    if (!data.tenantId) {
        throw new Error('tenantId is required to create a pixel entry.');
    }
    if (!data.fbPixelId && !data.tiktokPixelId) {
        const error = new Error('At least one of fbPixelId or tiktokPixelId is required.');
        error.statusCode = 400;
        throw error;
    }
    return this.create(data);
};

/**
 * Fetches all stored pixel entries for a specific tenant.
 * @param {string} tenantId - The ID of the tenant.
 * @returns {Promise<Array<object>>} An array of pixel documents.
 */
PixelSchema.statics.getAllPixelsForTenant = async function (tenantId) {
    return this.find({ tenantId }).sort({ createdAt: -1 }).lean();
};

/**
 * Deletes a pixel entry by its ID, ensuring it belongs to the correct tenant.
 * @param {string} id - The MongoDB _id of the pixel entry.
 * @param {string} tenantId - The ID of the tenant.
 * @returns {Promise<object|null>} The deleted pixel document, or null if not found.
 */
PixelSchema.statics.deletePixelForTenant = async function (id, tenantId) {
    // The query includes both the document _id and the tenantId to ensure
    // a user from one tenant cannot delete data belonging to another.
    return this.findOneAndDelete({ _id: id, tenantId }).lean();
};


const PixelModel = mongoose.model('Pixel', PixelSchema);

module.exports = PixelModel;
