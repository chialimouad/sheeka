/**
 * FILE: ./controllers/authController.js
 * DESC: This file contains the business logic for authentication-related
 * operations. It is imported by the router file.
 *
 * MODIFIED: Added defensive checks to each function to ensure the `req.tenant`
 * object is present before execution, preventing crashes if the tenant-finding
 * middleware has not run.
 */
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Generates a JSON Web Token (JWT).
 * @param {string} userId - The user's MongoDB ObjectId.
 * @param {string} tenantId - The tenant's MongoDB ObjectId.
 * @param {string} role - The user's role (e.g., 'admin', 'user').
 * @param {string} jwtSecret - The secret key for signing the token.
 * @returns {string} The generated JWT.
 */
const generateToken = (userId, tenantId, role, jwtSecret) => {
    return jwt.sign(
        { id: userId, tenantId, role },
        jwtSecret,
        { expiresIn: '28d' }
    );
};

// A helper function to check for the tenant object. If it's missing,
// it sends a 500 error and returns false.
const checkTenant = (req, res) => {
    if (!req.tenant) {
        console.error('Error: Tenant object not found on request. Check that tenant-resolution middleware is running before this route.');
        res.status(500).json({
            message: 'Server configuration error. Unable to process request.'
        });
        return false;
    }
    return true;
};


// Check email availability
exports.checkEmail = async (req, res) => {
    if (!checkTenant(req, res)) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email } = req.body;
        const existingUser = await req.tenant.model('User').findOne({ email });
        
        res.status(200).json({
            available: !existingUser,
            message: existingUser ? 'Email already in use' : 'Email available'
        });
    } catch (error) {
        console.error('Email check error:', error);
        res.status(500).json({
            message: 'Error checking email availability',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Register new user
exports.register = async (req, res) => {
    if (!checkTenant(req, res)) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, email, password, role, index } = req.body;
        const { tenant, jwtSecret } = req;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await tenant.model('User').create({
            name,
            email,
            password: hashedPassword,
            role: role || 'user',
            index: index || 0,
            tenantId: tenant._id
        });

        // Generate token
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
        res.status(500).json({
            message: 'Registration failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// User login
exports.login = async (req, res) => {
    if (!checkTenant(req, res)) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const { tenant, jwtSecret } = req;

        // Find user by email
        const user = await tenant.model('User').findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate token
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
        res.status(500).json({
            message: 'Login failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get all users for the current tenant
exports.getUsers = async (req, res) => {
    if (!checkTenant(req, res)) return;

    try {
        const users = await req.tenant.model('User').find(
            {},
            'name email role index createdAt' // Select specific fields
        );
        res.status(200).json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            message: 'Failed to get users',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get a specific user's index
exports.getUserIndex = async (req, res) => {
    if (!checkTenant(req, res)) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await req.tenant.model('User').findById(
            req.params.id,
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
        res.status(500).json({
            message: 'Failed to get user index',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update a user's index
exports.updateIndex = async (req, res) => {
    if (!checkTenant(req, res)) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { newIndexValue } = req.body;
        const { id } = req.params;
        const { user: requester, tenant } = req;

        // Authorization: Only an admin or the user themselves can update the index.
        if (requester.role !== 'admin' && requester.id !== id) {
            return res.status(403).json({ 
                message: 'Not authorized to update this user' 
            });
        }

        const updatedUser = await tenant.model('User').findByIdAndUpdate(
            id,
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
        res.status(500).json({
            message: 'Failed to update index',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
