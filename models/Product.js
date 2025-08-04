// models/Product.js

const mongoose = require('mongoose');

// Sub-schema for individual reviews, now linked to Customers
const reviewSchema = new mongoose.Schema({
    // This correctly references the Customer model, as they are the ones leaving reviews.
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Customer'
    },
    name: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});


const productSchema = new mongoose.Schema({
    // This tenantId field is the cornerstone of the multi-tenant architecture.
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'A tenant ID is required for every product.'],
        ref: 'Client',
        index: true,
    },
    // NEW: Added barcode field for product identification.
    barcode: {
        type: String,
        required: false // Set to true if a barcode is mandatory for every product.
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    olprice: {
        type: Number,
        required: false
    },
    promocode: {
        type: String,
        required: false
    },
    textpromo: {
        type: String,
        required: false
    },
    images: {
        type: [String],
        required: true
    },
    variants: [{
        colors: {
            type: [String],
            required: true
        },
        sizes: {
            type: [String],
            required: true
        }
    }],
    reviews: [reviewSchema],
    rating: {
        type: Number,
        required: true,
        default: 0
    },
    numReviews: {
        type: Number,
        required: true,
        default: 0
    }
}, {
    timestamps: true
});

// NEW: This compound index ensures that the 'barcode' is unique per 'tenantId'.
// The 'sparse' option means it will only enforce uniqueness for documents that have a barcode value.
// This allows you to have multiple products without a barcode.
productSchema.index({ tenantId: 1, barcode: 1 }, { unique: true, sparse: true });


module.exports = mongoose.model('Product', productSchema);
