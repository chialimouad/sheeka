/**
 * FILE: ./controllers/authController.js
 * DESC: This file contains the business logic for authentication-related
 * operations.
 *
 * MODIFIED: Corrected all database queries to use `req.tenant.tenantId` (a Number)
 * instead of `req.tenant._id` (an ObjectId) to match the User schema and
 * resolve the CastError.
 */
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Assuming a global User model

/**
 * Generates a JSON Web Token (JWT).
 * @param {string} userId - The user's MongoDB ObjectId.
 * @param {string} tenantId - The tenant's MongoDB ObjectId.
 * @param {string} role - The user's role (e.g., 'admin', 'user').
 * @param {string} jwtSecret - The secret key for signing the token.
 * @returns {string} The generated JWT.
 */
const generateToken = (userId, tenantId, role, jwtSecret) => {
    // Ensure the secret has a value before signing
    if (!jwtSecret) {
        throw new Error('JWT Secret is missing. Cannot generate token.');
    }
    return jwt.sign(
        { id: userId, tenantId, role },
        jwtSecret,
        { expiresIn: '28d' }
    );
};

// Check email availability for the current tenant
exports.checkEmail = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email } = req.body;
        // FIX: Use the numeric tenantId from the tenant object
        const existingUser = await User.findOne({ email, tenantId: req.tenant.tenantId });
        
        res.status(200).json({
            available: !existingUser,
            message: existingUser ? 'Email already in use' : 'Email available'
        });
    } catch (error) {
        console.error('Email check error:', error);
        res.status(500).json({ message: 'Error checking email availability' });
    }
};

// Register new user for the current tenant
exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, email, password, role, index } = req.body;
        const { tenant, jwtSecret } = req;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // FIX: Use the numeric tenantId to associate the user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'user',
            index: index || 0,
            tenantId: tenant.tenantId 
        });

        const token = generateToken(user._id, tenant.tenantId, user.role, jwtSecret);

        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                index: user.index
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed' });
    }
};

// User login for the current tenant
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const { tenant, jwtSecret } = req;

        // FIX: Find user by email and the numeric tenantId
        const user = await User.findOne({ email, tenantId: tenant.tenantId });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user._id, tenant.tenantId, user.role, jwtSecret);

        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                index: user.index
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed due to a server error.' });
    }
};

// Get all users for the current tenant
exports.getUsers = async (req, res) => {
    try {
        // FIX: Find all users that match the current tenant's numeric ID
        const users = await User.find(
            { tenantId: req.tenant.tenantId },
            'name email role index createdAt'
        );
        res.status(200).json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Failed to get users' });
    }
};

// Get a specific user's index
exports.getUserIndex = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        // FIX: Find user by their ID and the numeric tenantId
        const user = await User.findOne(
            { _id: req.params.id, tenantId: req.tenant.tenantId },
            'index' // Select only the index field
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            index: user.index,
            userId: user._id
        });
    } catch (error) {
        console.error('Get user index error:', error);
        res.status(500).json({ message: 'Failed to get user index' });
    }
};

// Update a user's index
exports.updateIndex = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { newIndexValue } = req.body;
        const { id } = req.params;
        const { user: requester } = req; // `protect` middleware adds req.user

        // Authorization: Only an admin or the user themselves can update the index.
        if (requester.role !== 'admin' && requester.id.toString() !== id) {
            return res.status(403).json({ 
                message: 'Not authorized to update this user' 
            });
        }

        // FIX: Ensure the update operation is scoped to the numeric tenantId
        const updatedUser = await User.findOneAndUpdate(
            { _id: id, tenantId: req.tenant.tenantId }, 
            { index: newIndexValue },
            { new: true, select: '_id index role' } // Return the updated document
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            message: 'Index updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update index error:', error);
        res.status(500).json({ message: 'Failed to update index' });
    }
};
