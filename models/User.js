const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },  // Password is stored as plain text
  role: { 
    type: String, 
    enum: ['admin', 'confirmation', 'stockagent'], 
    default: 'confirmation' // Default role
  },
});

module.exports = mongoose.model('User', UserSchema);
