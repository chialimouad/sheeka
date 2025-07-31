// models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    // tenantId links the user to a specific client instance. This is crucial for data isolation.
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'A tenant ID is required for every user.'],
        ref: 'Client', // This creates a reference to the new Client model
        index: true,   // Indexing this field improves query performance
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true, // Ensures email is stored in a consistent format
    },
    password: {
        type: String,
        required: true,
        select: false, // By default, do not include the password in query results
    },
    role: {
        type: String,
        enum: ['admin', 'confirmation', 'stockagent', 'user'], // Added 'user' for flexibility
        default: 'user',
    },
    index: {
        type: Number,
        enum: [0, 1],
        default: 0,
    },
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
    }],
}, {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
});

// Create a compound index. This ensures that the 'email' is unique for each 'tenantId'.
// This is the core of multi-tenant user management.
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// Mongoose 'pre-save' hook to automatically hash the password before saving
UserSchema.pre('save', async function (next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to compare a candidate password with the user's hashed password
UserSchema.methods.comparePassword = async function (candidatePassword) {
    // 'this.password' is not available here if `select: false` is used,
    // so we must explicitly query for it when needed (e.g., in the login controller).
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
