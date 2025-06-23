const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  // Reference to the 'Email' document that this response is for
  emailId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email',
    required: true,
    unique: true // Ensure only one response per original email
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Response', responseSchema);
