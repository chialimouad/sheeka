/**
 * FILE: ./controllers/authController.js
 * DESC: This file contains the business logic for authentication-related
 * operations.
 *
 * MODIFIED: Refactored database queries to use a standard User model filtered
 * by a tenantId, removing the dependency on the problematic `req.tenant.model()`
 * method. This aligns with modern multi-tenancy practices and fixes the login logic.
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
        // Query the global User model, but scope it to the current tenant
        const existingUser = await User.findOne({ email, tenantId: req.tenant._id });
        
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

        // Create the user with the tenantId to scope it correctly
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'user',
            index: index || 0,
            tenantId: tenant._id // Associate user with the tenant
        });

        const token = generateToken(user._id, tenant._id, user.role, jwtSecret);

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

        // Find user by email, ensuring they belong to the correct tenant
        const user = await User.findOne({ email, tenantId: tenant._id });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user._id, tenant._id, user.role, jwtSecret);

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
        // Find all users that match the current tenant's ID
        const users = await User.find(
            { tenantId: req.tenant._id },
            'name email role index createdAt'
        );
        res.status(200).json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Failed to get users' });
    }
};
