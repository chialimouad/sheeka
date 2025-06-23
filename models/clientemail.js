const mongoose = require('mongoose');

const clientEmailSchema = new mongoose.Schema({
  emailAddress: {
    type: String,
    required: true,
    unique: true, // Ensure uniqueness of client emails
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  }
}, { timestamps: true });

module.exports = mongoose.model('ClientEmail', clientEmailSchema);

