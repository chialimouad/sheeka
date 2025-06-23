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
  // Use environment variables, a secrets manager, or OAuth for email authentication.
  password: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminCredential', adminCredentialSchema);

