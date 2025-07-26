const mongoose = require('mongoose');

const adminCredentialSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true, // There should ideally only be one admin credential
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  // WARNING: Storing passwords directly in the database is a severe security risk.
  // In a production environment, never store passwords in plaintext.
  // Consider using environment variables, a secrets manager, or OAuth for email authentication,
  // or re-implementing password hashing (e.g., with bcryptjs) for better security.
  password: {
    type: String,
    required: true
  },
  // Updated field: 'index' now restricts values to 0 or 1
  index: {
    type: Number,
    enum: [0, 1], // Ensures the 'index' field can only be 0 or 1
    default: 0   // Sets a default value of 0, aligning with "0 for on server"
  }
}, { timestamps: true });


module.exports = mongoose.model('AdminCredential', adminCredentialSchema);
