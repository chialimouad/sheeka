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
    required: [true, 'Address is required.']
  },
  products: {
    type: [{
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
    default: [] // Ensures products is always an array
  },
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
  // NEW: Field to track when each status was set.
  statusTimestamps: {
    type: Map,
    of: Date,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

// NEW: Mongoose hook to automatically update status timestamps before saving.
orderSchema.pre('save', function(next) {
  // If the document is new, set the initial status timestamp.
  if (this.isNew) {
    this.statusTimestamps.set(this.status, new Date());
  }
  
  // If the status has been modified, record the timestamp for the new status.
  if (this.isModified('status')) {
    this.statusTimestamps.set(this.status, new Date());
  }
  
  next();
});


const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
