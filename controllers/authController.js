const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

/**
 * @function generateToken
 * @description Generates a JSON Web Token (JWT) for a user of a specific tenant.
 * @param {string} userId - The user's unique ID.
 * @param {string} tenantId - The tenant's unique ID.
 * @param {string} role - The user's role.
 * @param {string} jwtSecret - The tenant's specific JWT secret.
 * @returns {string} The generated JWT.
 */
const generateToken = (userId, tenantId, role, jwtSecret) => {
    return jwt.sign({ id: userId, tenantId, role }, jwtSecret, { expiresIn: '28d' });
};

/**
 * @function checkEmail
 * @description Checks if an email is available for registration
 */
exports.checkEmail = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    try {
        const existingUser = await User.findOne({ 
            email: email.toLowerCase(), 
            tenantId: req.tenantId 
        });
        
        res.json({
            available: !existingUser,
            message: existingUser ? 'Email already in use' : 'Email available'
        });
    } catch (error) {
        console.error('Email check error:', error);
        res.status(500).json({ message: 'Error checking email availability' });
    }
};

/**
 * @function register
 * @description Handles user registration for the identified tenant.
 */
exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { tenantId, jwtSecret } = req;
    const { name, email, password, role, index } = req.body;

    try {
        // Case-insensitive email check
        const existingUser = await User.findOne({ 
            email: email.toLowerCase(), 
            tenantId 
        });
        
        if (existingUser) {
            return res.status(409).json({ 
                message: 'User with this email already exists for this tenant.' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: role || 'user',
            index: typeof index === 'number' ? index : 0,
            tenantId,
        });

        const token = generateToken(newUser._id, newUser.tenantId, newUser.role, jwtSecret);

        res.status(201).json({
            message: "Registration successful",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                index: newUser.index,
            },
            token
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ 
            message: 'Server error during registration.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @function login
 * @description Handles user login for the identified tenant.
 */
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { tenantId, jwtSecret } = req;
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ 
            email: email.toLowerCase(), 
            tenantId 
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = generateToken(user._id, user.tenantId, user.role, jwtSecret);

        res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                index: user.index,
            },
            token
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ 
            message: 'Server error during login.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @function getUsers
 * @description Fetches a list of all users for the current tenant.
 */
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({ 
            tenantId: req.user.tenantId 
        }, 'name email role index createdAt');
        
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ 
            message: 'Server error: Could not retrieve users.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @function updateIndex
 * @description Updates a user's 'index' field by ID, scoped to the current tenant.
 */
exports.updateIndex = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { newIndexValue } = req.body;
        const userIdToUpdate = req.params.id;
        const requestingUser = req.user;

        // Authorization check
        if (requestingUser.role !== 'admin' && requestingUser.id !== userIdToUpdate) {
            return res.status(403).json({ 
                message: 'Forbidden: You do not have permission to perform this action.' 
            });
        }

        const updatedUser = await User.findOneAndUpdate(
            { 
                _id: userIdToUpdate, 
                tenantId: requestingUser.tenantId 
            },
            { index: newIndexValue },
            { 
                new: true, 
                runValidators: true,
                select: '_id index role'
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ 
                message: 'User not found within your organization.' 
            });
        }

        res.status(200).json({
            message: 'User index updated successfully',
            user: {
                id: updatedUser._id,
                index: updatedUser.index,
                role: updatedUser.role,
            }
        });

    } catch (error) {
        console.error('Update Index Error:', error);
        res.status(500).json({ 
            message: 'Server error during index update.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @function getUserIndex
 * @description Fetches a specific user's 'index' field by ID, scoped to the current tenant.
 */
exports.getUserIndex = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const userId = req.params.id;
        const tenantId = req.user.tenantId;

        const user = await User.findOne({ 
            _id: userId, 
            tenantId 
        }, 'index');

        if (!user) {
            return res.status(404).json({ 
                message: 'User not found within your organization.' 
            });
        }

        if (user.index === undefined || user.index === null) {
            return res.status(404).json({ 
                message: 'User index not set for this user.' 
            });
        }

        res.status(200).json({
            message: 'User index fetched successfully',
            userId: user._id,
            index: user.index
        });

    } catch (error) {
        console.error('Get User Index Error:', error);
        res.status(500).json({ 
            message: 'Server error while fetching user index.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
