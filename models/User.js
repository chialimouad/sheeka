const mongoose = require('mongoose');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  salt: { type: String, required: true }, // Store the salt
  role: { 
    type: String, 
    enum: ['admin', 'confirmation', 'stockagent'], 
    default: 'confirmation' // Default role
  },
});

// Ensure that the salt is properly added to the schema when creating a new user
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // Generate salt for password hashing
  const salt = crypto.randomBytes(16).toString('hex');
  this.salt = salt;

  this.password = crypto
    .createHash('sha256')
    .update(this.password + salt)  // Combine password and salt
    .digest('hex');

  next();
});

module.exports = mongoose.model('User', UserSchema);
