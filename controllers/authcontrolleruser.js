// ==================================================================================
// FILE: ./controllers/authController.js
// INSTRUCTIONS: This file's content remains the same.
// ==================================================================================
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const generateToken = (userId, tenantId, jwtSecret) => {
    if (!jwtSecret) {
        throw new Error('JWT Secret is missing for this client.');
    }
    return jwt.sign({ id: userId, tenantId: tenantId }, jwtSecret, {
        expiresIn: '30d',
    });
};

const AuthController = {
    login: async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const tenant = req.tenant; // Attached by identifyTenant middleware

        try {
            const user = await User.findOne({ email: email.toLowerCase(), tenantId: tenant.tenantId });

            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }

            if (user.index !== 1) {
                return res.status(401).json({ message: 'This account is not active. Please contact an administrator.' });
            }

            const jwtSecret = tenant.config.jwtSecret;
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
    },

    registerUser: async (req, res) => {
        const { name, email, password, role } = req.body;
        const tenantId = req.tenant.tenantId;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Please provide all required fields.' });
        }

        try {
            const userExists = await User.findOne({ email: email.toLowerCase(), tenantId });
            if (userExists) {
                return res.status(400).json({ message: 'User with this email already exists for this tenant.' });
            }

            const newUser = await User.create({
                name,
                email: email.toLowerCase(),
                password, // Hashing is handled by the User model's pre-save hook
                role,
                tenantId,
                index: 1 // Ensure user is active by default
            });

            res.status(201).json({
                message: 'User registered successfully.',
                user: {
                    _id: newUser._id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    index: newUser.index
                }
            });
        } catch (error) {
            console.error('User registration error:', error);
            res.status(500).json({ message: 'Server error during user registration.' });
        }
    },

    getUsers: async (req, res) => {
        try {
            const users = await User.find({ tenantId: req.tenant.tenantId }).select('-password');
            res.status(200).json(users);
        } catch (error) {
            console.error('Fetch users error:', error);
            res.status(500).json({ message: 'Server error fetching users.' });
        }
    },

    updateUserStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { index } = req.body;

            if (index === undefined || (index !== 0 && index !== 1)) {
                return res.status(400).json({ message: 'Invalid status index provided. Must be 0 or 1.' });
            }

            const user = await User.findOne({ _id: id, tenantId: req.tenant.tenantId });

            if (!user) {
                return res.status(404).json({ message: 'User not found for this tenant.' });
            }

            user.index = index;
            await user.save();

            res.status(200).json({ message: 'User status updated successfully.', user });
        } catch (error) {
            console.error('Update user status error:', error);
            res.status(500).json({ message: 'Server error updating user status.' });
        }
    }
};

module.exports = AuthController;
