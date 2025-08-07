/**
 * FILE: ./controllers/authController.js
 * DESC: Handles user authentication, registration, and management.
 * * FIX: 
 * - The `login` function now checks if `user.index` is 1 (Active).
 * - If the user is inactive, it returns a 401 Unauthorized error with a clear message.
 * This prevents inactive users from logging in and completes the activation workflow.
 */
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); 
const { validationResult } = require('express-validator');

// --- Helper function to generate JWT ---
const generateToken = (userId, tenantId, jwtSecret) => {
    if (!jwtSecret) {
        throw new Error('JWT Secret is missing for this client.');
    }
    return jwt.sign({ id: userId, tenantId: tenantId }, jwtSecret, {
        expiresIn: '30d',
    });
};

/**
 * @desc      Authenticate a staff user and return a token
 * @route     POST /users/login
 * @access    Public (Tenant header required)
 */
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const tenantId = req.tenantId; // From identifyTenant middleware

    try {
        // Find the user scoped to the specific tenant
        const user = await User.findOne({ email: email.toLowerCase(), tenantId: tenantId });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials or user does not exist for this tenant.' });
        }

        // Check if the password matches
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // FIX: Check if the user's account is active before allowing login.
        if (user.index !== 1) {
            return res.status(401).json({ message: 'This account is not active. Please contact an administrator.' });
        }

        // We get the secret from the client object attached by the middleware.
        const jwtSecret = req.client.config.jwtSecret;

        // Generate the token with the specific client's secret
        const token = generateToken(user._id, user.tenantId, jwtSecret);

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: error.message || 'Server error during login.' });
    }
};

/**
 * @desc      Register a new staff user for the current tenant
 * @route     POST /users/register
 * @access    Private (Admin Only)
 */
exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role } = req.body;
    const tenantId = req.tenantId; // From identifyTenant middleware

    try {
        // Check if user already exists for this tenant
        let user = await User.findOne({ email: email.toLowerCase(), tenantId });
        if (user) {
            return res.status(400).json({ message: 'User with this email already exists for this tenant.' });
        }

        user = new User({
            tenantId,
            name,
            email,
            password, // Hashed by pre-save hook
            role,
            // Note: The 'index' field will default to 0 (Inactive) based on the schema, which is correct.
        });

        await user.save();

        res.status(201).json({
            message: 'User registered successfully. They must be activated by an admin to log in.',
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

// --- User Management Functions ---

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({ tenantId: req.tenantId }).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.updateIndex = async (req, res) => {
    const { id } = req.params;
    // Note: The frontend sends 'index', not 'newIndexValue'.
    const { index } = req.body; 

    if (typeof index !== 'number') {
        return res.status(400).json({ message: 'Index value must be a number (0 or 1).' });
    }

    try {
        const user = await User.findOneAndUpdate(
            { _id: id, tenantId: req.tenantId },
            { $set: { index: index } },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found for this tenant.' });
        }

        res.json({ message: 'User status updated successfully.', user });
    } catch (error) {
        console.error('Update Index Error:', error);
        res.status(500).json({ message: 'Server error while updating user status.' });
    }
};

// This function is not used by the frontend but is good practice to have.
exports.getUserIndex = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId }).select('index');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ index: user.index });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
};
