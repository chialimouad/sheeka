const mongoose = require('mongoose');

// Define the schema for a Collection
const collectionSchema = new mongoose.Schema({
    // Name of the collection (e.g., "Summer Sale", "New Arrivals")
    // It's required and must be unique to prevent duplicate collection names.
    name: { 
        type: String, 
        required: true, 
        unique: true 
    },
    // Optional URL for a thumbnail image representing the collection.
    // This can be used to display a preview of the collection in the app.
    thumbnailUrl: { 
        type: String 
    },
    // An array of MongoDB ObjectId references to products included in this collection.
    // The 'ref: 'Product'' tells Mongoose that these ObjectIds refer to documents
    // in the 'Product' collection.
    productIds: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product' 
    }]
}, { 
    // timestamps: true automatically adds createdAt and updatedAt fields to documents.
    // createdAt: Records the time the document was first created.
    // updatedAt: Records the time the document was last modified.
    timestamps: true 
});

// Export the Mongoose model based on the collectionSchema.
// The model name 'Collection' will correspond to a 'collections' collection in MongoDB.
module.exports = mongoose.model('Collection', collectionSchema);
