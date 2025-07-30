// models/Order.js
// No changes were needed in this file. It is included for completeness.
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
    // Address field is optional
    address: {
        type: String,
        required: false
    },
    // This is the field for the custom barcode ID.
    barcodeId: {
        type: String,
        trim: true,
        default: null
    },
    products: [{
        // Note: For simplicity on the frontend, you might send populated product names.
        // If not, you'll need to adjust the frontend to handle just the ID.
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: {
            type: String
        }, // Denormalizing name for easier display
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
    // This field will store the history of status changes.
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
// This will run before a new document is saved.
orderSchema.pre('save', function(next) {
    // 'this' refers to the document being saved.
    // isNew is a Mongoose boolean property that is true if the document is new.
    if (this.isNew) {
        // Set the timestamp for the 'pending' status to the current time.
        this.statusTimestamps.set('pending', new Date());
    }
    next(); // Continue with the save operation.
});


const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
