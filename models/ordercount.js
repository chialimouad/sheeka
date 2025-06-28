
const mongoose = require('mongoose');

const OrderCountSchema = new mongoose.Schema({
  // The aggregated count of all orders based on applied filters
  count: {
    type: Number,
    required: true,
  },
  // The timestamp when this count was recorded
  timestamp: {
    type: Date,
    default: Date.now, // Defaults to the current date/time when a new document is created
    required: true,
  },
  // Optional: Store the user who initiated the count (e.g., the dashboard user)
  userId: {
    type: String,
    required: false, // Set to true if every count must be associated with a user
  },
  // Optional: Store the date filter applied when this count was generated
  dateFilter: {
    type: String,
    enum: ['all', 'today', 'thisWeek', 'thisMonth', 'custom'], // Ensure valid enum values
    default: 'all',
    required: false,
  },
  // Optional: Store the status filter applied when this count was generated
  statusFilter: {
    type: String,
    enum: ['all', 'pending', 'confirmed', 'cancelled', 'tentative', 'dispatched'], // Ensure valid enum values
    default: 'all',
    required: false,
  },
  // You can add more fields here if you need to store other context
  // for example, the specific custom date range if dateFilter is 'custom':
  // customStartDate: { type: Date, required: false },
  // customEndDate: { type: Date, required: false },
}, {
  timestamps: true // Adds `createdAt` and `updatedAt` fields automatically
});

// Create and export the Mongoose model
const OrderCount = mongoose.model('OrderCount', OrderCountSchema);

module.exports = OrderCount;
