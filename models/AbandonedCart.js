// models/AbandonedCart.js

const mongoose = require('mongoose');

const abandonedCartSchema = new mongoose.Schema({
    // This tenantId field is crucial for data isolation.
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Client',
        index: true,
    },
    fullName: { type: String, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    wilaya: String,
    commune: String,
    product: {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: String,
        quantity: Number,
        color: String,
        size: String,
        price: Number
    },
    pageUrl: String,
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Ensures a customer can only have one abandoned cart per product for each client.
abandonedCartSchema.index({ tenantId: 1, phoneNumber: 1, 'product.productId': 1 }, { unique: true });

// Automatically remove the document after 30 days
abandonedCartSchema.pre('save', function(next) {
    this.updatedAt = new Date(); // Set expiry based on the last update
    next();
});
abandonedCartSchema.index({ "updatedAt": 1 }, { expireAfterSeconds: 2592000 }); // 30 days


module.exports = mongoose.model('AbandonedCart', abandonedCartSchema);
