const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = 'jsonwebtoken';
const { validationResult } = require('express-validator');

// --- Helper function to generate JWT ---
// It now correctly accepts the secret from the client's config.
const generateToken = (userId, tenantId, jwtSecret) => {
    if (!jwtSecret) {
        throw new Error('JWT Secret is missing for this client.');
    }
    return jwt.sign({ id: userId, tenantId: tenantId }, jwtSecret, {
        expiresIn: '30d', // Set a reasonable expiration time
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

        // --- THIS IS THE FIX ---
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
 * @access    Private (Admin Only - for now, can be adjusted)
 */
exports.register = async (req, res) => {
    // This function should typically be protected and only accessible by an admin of the tenant.
    // For now, we'll assume the logic is correct but highlight this security consideration.
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
            password, // Password will be hashed by the pre-save hook in the User model
            role,
        });

        await user.save();

        // Don't return a token on register, force them to log in.
        res.status(201).json({
            message: 'User registered successfully.',
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};


// --- Placeholder functions for other routes ---
// You can fill these in with your actual business logic.

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({ tenantId: req.tenantId }).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getUserIndex = async (req, res) => {
    // Implement logic to get a user's index
    res.status(501).json({ message: 'Not implemented' });
};

exports.updateIndex = async (req, res) => {
    // Implement logic to update a user's index
    res.status(501).json({ message: 'Not implemented' });
};
