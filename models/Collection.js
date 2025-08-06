const mongoose = require('mongoose');

// Define the schema for a Collection
const collectionSchema = new mongoose.Schema({
    // FIX: Added tenantId to associate each collection with a specific store.
    // This is the most critical change for the multi-tenant architecture to work.
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'A tenant ID is required for every collection.'],
        ref: 'Client', // This should match the name of your tenant/client model
        index: true,   // Indexing this field makes tenant-specific queries much faster.
    },
    
    // Name of the collection (e.g., "Summer Sale", "New Arrivals")
    name: { 
        type: String, 
        required: true, 
        // The global 'unique: true' constraint is removed from here.
    },

    // Optional URL for a thumbnail image representing the collection.
    thumbnailUrl: { 
        type: String 
    },

    // An array of MongoDB ObjectId references to products included in this collection.
    productIds: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product' 
    }]
}, { 
    // Automatically adds createdAt and updatedAt fields to documents.
    timestamps: true 
});

// FIX: Added a compound index.
// This ensures that the collection 'name' is unique PER tenant, which is correct.
// It allows different stores to have a collection with the same name (e.g., "New Arrivals").
collectionSchema.index({ tenantId: 1, name: 1 }, { unique: true });


// Export the Mongoose model.
module.exports = mongoose.model('Collection', collectionSchema);
