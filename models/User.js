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
  orders: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    }
  ]
});

module.exports = mongoose.model('User', UserSchema);
