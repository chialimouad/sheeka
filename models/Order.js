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
  // Address field is optional
  address: {
    type: String,
    required: false
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
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
    }
  ],
  totalOrdersCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'tentative', 'dispatched', 'delivered', 'returned'],
    default: 'pending'
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

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
