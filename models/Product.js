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

module.exports = mongoose.model('Product', productSchema);
