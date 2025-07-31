// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
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
        name: {
            type: String
        },
        quantity: {
            type: Number,
            required: true
        },
        color: {
            type: String,
            required: true
        },
        size: {
            type: String,
            required: true
        }
    }],
    totalOrdersCount: {
        type: Number,
        default: 0
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
        ref: 'User',
        default: null
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    notes: {
        type: String,
        default: ''
    },
    // --- NEW FIELD FOR TRACKING ---
    source: {
        type: String,
        enum: ['web', 'abandoned_cart_recovery'],
        default: 'web'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

orderSchema.pre('save', function(next) {
    if (this.isNew) {
        this.statusTimestamps.set('pending', new Date());
    }
    next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
