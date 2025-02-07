const mongoose = require('mongoose');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'confirmation', 'stockagent'], 
    default: 'confirmation' // Default role
  },
});

// Hash password before saving using crypto
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = crypto
    .createHash('sha256')
    .update(this.password)
    .digest('hex');

  next();
});

// Compare passwords using the same hash function
UserSchema.methods.comparePassword = function(candidatePassword) {
  const hashedCandidatePassword = crypto
    .createHash('sha256')
    .update(candidatePassword)
    .digest('hex');
  return this.password === hashedCandidatePassword;
};

module.exports = mongoose.model('User', UserSchema);
