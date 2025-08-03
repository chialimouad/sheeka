/**
 * FILE: ./controllers/authController.js
 * DESC: This file contains the business logic for authentication-related
 * operations in a multi-tenant environment.
 *
 * MODIFIED:
 * - Added a critical check in the 'register' function to prevent duplicate user
 * registrations within the same tenant.
 * - Re-introduced explicit checks and detailed logging in 'login' and 'register'
 * to ensure the tenant is properly identified by the middleware, making
 * debugging easier and the code more robust.
 * - Ensured all database queries correctly use `req.tenant.tenantId`.
 */
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Assuming a global User model

/**
 * Generates a JSON Web Token (JWT).
 * @param {string} userId - The user's MongoDB ObjectId.
 * @param {number} tenantId - The tenant's numeric ID.
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
        // Ensure tenant object exists before querying
        if (!req.tenant || !req.tenant.tenantId) {
             return res.status(500).json({ message: 'Server configuration error: Could not identify tenant.' });
        }
        const existingUser = await User.findOne({ email, tenantId: req.tenant.tenantId });

        res.status(200).json({
            available: !existingUser,
            message: existingUser ? 'Email already in use for this tenant' : 'Email available'
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

        // CRITICAL CHECK: Ensure tenant was identified before proceeding.
        if (!tenant || !tenant.tenantId || !jwtSecret) {
            console.error('REGISTRATION ERROR: Tenant identification failed. The `tenant` or `jwtSecret` object was not found on the request.');
            return res.status(500).json({ message: 'Server configuration error: Could not identify tenant.' });
        }
        
        // FIX: Check if a user with this email already exists for this specific tenant.
        let user = await User.findOne({ email, tenantId: tenant.tenantId });
        if (user) {
            return res.status(400).json({ message: 'A user with this email already exists for this tenant.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create the new user, ensuring it's associated with the numeric tenantId
        user = await User.create({
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
        res.status(500).json({ message: 'Registration failed due to a server error.' });
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
        
        console.log('--- LOGIN ATTEMPT ---');
        console.log('Looking for tenant via hostname:', req.hostname);

        // CRITICAL CHECK: Ensure tenant was identified before proceeding.
        if (!tenant || !tenant.tenantId || !jwtSecret) {
            console.error('LOGIN ERROR: Tenant identification failed. The `tenant` or `jwtSecret` object was not found on the request. Check middleware configuration.');
            return res.status(500).json({ message: 'Server configuration error: Could not identify tenant.' });
        }
        
        console.log(`Tenant identified: ${tenant.name} (ID: ${tenant.tenantId})`);
        console.log(`Querying for user with email: "${email}" in tenantId: ${tenant.tenantId}`);

        // Find user by email and the numeric tenantId
        const user = await User.findOne({ email, tenantId: tenant.tenantId });
        if (!user) {
            console.log('Login Failure: No user found with the provided email for this tenant.');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`Login Failure: Password mismatch for user: ${user.email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        console.log('Login Success: Password matched. Generating token.');
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
        console.error('A critical error occurred in the login controller:', error);
        res.status(500).json({ message: 'Login failed due to a server error.' });
    }
};

// Get all users for the current tenant
exports.getUsers = async (req, res) => {
    try {
        // Find all users that match the current tenant's numeric ID
        const users = await User.find(
            { tenantId: req.tenant.tenantId },
            'name email role index createdAt' // Select specific fields
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
        // Find user by their ID and the numeric tenantId
        const user = await User.findOne(
            { _id: req.params.id, tenantId: req.tenant.tenantId },
            'index' // Select only the index field
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found in this tenant' });
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

        // Ensure the update operation is scoped to the numeric tenantId
        const updatedUser = await User.findOneAndUpdate(
            { _id: id, tenantId: req.tenant.tenantId },
            { index: newIndexValue },
            { new: true, select: '_id index role' } // Return the updated document
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found in this tenant' });
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
