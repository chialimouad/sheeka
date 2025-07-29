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
        // Denormalizing name for easier display and historical record
        name: {
            type: String,
            required: true
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
    // RENAMED for clarity: This now correctly represents the total number of items.
    totalItemsCount: {
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
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Mongoose middleware to automatically set the timestamp for the initial 'pending' status.
orderSchema.pre('save', function(next) {
    // If the document is new, set the 'pending' timestamp.
    if (this.isNew) {
        if (!this.statusTimestamps) {
            this.statusTimestamps = new Map();
        }
        this.statusTimestamps.set('pending', new Date());
    }
    next(); // Continue with the save operation.
});


const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
