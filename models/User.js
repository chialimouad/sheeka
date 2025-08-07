const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    tenantId: {
        type: Number,
        required: true,
        index: true, 
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'confirmation', 'stockagent', 'user', 'employee'], // Added 'employee' from other file
        default: 'user',
    },
    // FIX: Add the missing index field here
    index: {
        type: Number,
        required: true,
        default: 0, // Default to 0 (Inactive)
    },
}, { timestamps: true });


// Hash password before saving the user
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('User', userSchema);
