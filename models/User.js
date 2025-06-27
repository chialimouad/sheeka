const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },  // Password stored as plain text (not recommended)
  role: { 
    type: String, 
    enum: ['admin', 'confirmation', 'stockagent'], 
    default: 'confirmation'
  },
  index: {
    type: Number,
    enum: [0, 1], // Ensures the 'index' field can only be 0 or 1
    default: 0   // Sets a default value of 0, aligning with "0 for on server"
  },
  orders: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    }
  ]
});

module.exports = mongoose.model('User', UserSchema);
