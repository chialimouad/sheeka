const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // This is the corrected part. It should be a Number.
    tenantId: {
        type: Number,
        required: true,
        index: true, // Good for performance when looking up users by tenant.
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, // Emails should be unique within a tenant, handled by controller logic.
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'confirmation', 'stockagent', 'user'],
        default: 'user',
    },
    // You can add other fields like 'isActive', etc.
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
