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
  products: [{
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
  }],
  status: { // Added status field
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'tentative'], // Allowed values for status
    default: 'pending' // Default status when an order is created
  },
  confirmedBy: { // Field for the agent who confirmed the order
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Changed from 'Client' to 'User'
    required: false
  },
  assignedTo: { // Field for the agent assigned to handle the order
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Changed from 'Client' to 'User'
    required: false // Optional, as an order might not be assigned initially
  },
  notes: { // Field for order notes
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
