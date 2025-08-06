const mongoose = require('mongoose');

// Define the schema for a Collection
const collectionSchema = new mongoose.Schema({
    // FIX: Added tenantId to associate collections with a specific store.
    // This is a critical part of the multi-tenant architecture.
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'A tenant ID is required for every collection.'],
        ref: 'Client', // Or 'Tenant', depending on your tenant model's name
        index: true, // Index this field for faster queries
    },
    // Name of the collection (e.g., "Summer Sale", "New Arrivals")
    name: { 
        type: String, 
        required: true, 
        // The 'unique' constraint is now handled by the compound index below
    },
    // Optional URL for a thumbnail image representing the collection.
    thumbnailUrl: { 
        type: String 
    },
    // An array of MongoDB ObjectId references to products in this collection.
    productIds: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product' 
    }]
}, { 
    // Automatically adds createdAt and updatedAt fields
    timestamps: true 
});

// FIX: Added a compound index.
// This ensures that the 'name' of a collection is unique PER tenant,
// allowing different stores to have a collection named "Summer Sale".
collectionSchema.index({ tenantId: 1, name: 1 }, { unique: true });

// Export the Mongoose model.
module.exports = mongoose.model('Collection', collectionSchema);
