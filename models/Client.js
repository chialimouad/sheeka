const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // No hashing
  profileImage: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Client', ClientSchema);
