/**
 * FILE: ./controllers/authController.js
 * DESC: Controller functions for user registration, authentication, and management.
 * * UPDATE:
 * - Added a new `login` function to handle user authentication.
 * - The `login` function checks if a user's `index` is 1 (Active) before issuing a token,
 * preventing inactive users from logging in.
 * - Integrated a `generateToken` helper function for creating JWTs.
 * - Maintained a consistent structure by adding `login` to the AuthController object.
 */
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
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

const AuthController = {
    /**
     * @desc     Authenticate a staff user and return a token
     * @route    POST /users/login
     * @access   Public (Tenant header required)
     */
    login: async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        // The entire tenant client object is attached by the identifyTenant middleware
        const tenant = req.tenant;

        try {
            const user = await User.findOne({ email: email.toLowerCase(), tenantId: tenant.tenantId });

            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials or user does not exist for this tenant.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }

            // FIX: Check if the user's account is active before allowing login.
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

    /**
     * @desc    Register a new user for the current tenant.
     * @route   POST /users/register
     * @access  Private (Admin)
     */
    registerUser: async (req, res) => {
        try {
            const { name, email, password, role } = req.body;
            const tenantId = req.tenant.tenantId; // Numeric ID from identifyTenant middleware

            if (!name || !email || !password || !role) {
                return res.status(400).json({ message: 'Please provide all required fields.' });
            }

            const userExists = await User.findOne({ email, tenantId });
            if (userExists) {
                return res.status(400).json({ message: 'User with this email already exists for this tenant.' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = await User.create({
                name,
                email,
                password: hashedPassword,
                role,
                tenantId,
                // 'index' defaults to 1 (Active) based on the User model
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

    /**
     * @desc    Get all users for the current tenant.
     * @route   GET /users
     * @access  Private (Admin)
     */
    getUsers: async (req, res) => {
        try {
            const tenantId = req.tenant.tenantId;
            const users = await User.find({ tenantId }).select('-password');
            res.status(200).json(users);
        } catch (error) {
            console.error('Fetch users error:', error);
            res.status(500).json({ message: 'Server error fetching users.' });
        }
    },

    /**
     * @desc    Update a user's status (active/inactive).
     * @route   PUT /users/:id/index
     * @access  Private (Admin)
     */
    updateUserStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { index } = req.body;
            const tenantId = req.tenant.tenantId;

            if (index === undefined || (index !== 0 && index !== 1)) {
                return res.status(400).json({ message: 'Invalid status index provided. Must be 0 or 1.' });
            }

            const user = await User.findOne({ _id: id, tenantId });

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
