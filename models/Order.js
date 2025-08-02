// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // This tenantId field ensures every order is tied to a specific client.
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Client',
        index: true,
    },
    fullName: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true,
        match: [/^(\+213|0)(5|6|7)[0-9]{8}$/, 'Invalid Algerian phone number']
    },
    wilaya: {
        type: String,
        required: true
    },
    commune: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: false
    },
    barcodeId: {
        type: String,
        trim: true,
        default: null
    },
    products: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: { type: String, required: true }, // Snapshot of product name
        quantity: { type: Number, required: true },
        priceAtPurchase: { type: Number, required: true }, // Snapshot of price per unit
        color: { type: String },
        size: { type: String }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'tentative', 'dispatched', 'delivered', 'returned'],
        default: 'pending'
    },
    statusTimestamps: {
        type: Map,
        of: Date,
        default: {}
    },
    confirmedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Staff member who confirmed
        default: null
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Staff member for delivery
        default: null
    },
    notes: {
        type: String,
        default: ''
    },
    source: {
        type: String,
        enum: ['web', 'abandoned_cart_recovery'],
        default: 'web'
    },
}, {
    timestamps: true
});

orderSchema.pre('save', function(next) {
    if (this.isNew) {
        this.statusTimestamps.set('pending', new Date());
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);
