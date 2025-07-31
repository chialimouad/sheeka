// controllers/userController.js

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult, param } = require('express-validator');

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
    // The JWT now includes the tenantId to scope all future requests.
    return jwt.sign({ id: userId, tenantId, role }, jwtSecret, { expiresIn: '28d' });
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

    // The tenantId and jwtSecret are attached to the request by our new middleware.
    const { tenantId, jwtSecret } = req;
    const { name, email, password, role, index } = req.body;

    try {
        // Ensure user doesn't exist for THIS tenant.
        const existingUser = await User.findOne({ email: email.toLowerCase(), tenantId });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists for this client.' });
        }

        // The User model's pre-save hook will handle hashing.
        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            role: role || 'user', // Default to 'user' role
            index: typeof index === 'number' ? index : 0, // Default to 0
            tenantId, // Associate the new user with the current tenant
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
        res.status(500).json({ message: 'Server error during registration.' });
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
        // Find the user associated with THIS tenant and explicitly select the password
        const user = await User.findOne({ email: email.toLowerCase(), tenantId }).select('+password');

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // The User model's comparePassword method can be used if available, or compare directly.
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
        res.status(500).json({ message: 'Server error during login.' });
    }
};

/**
 * @function getUsers
 * @description Fetches a list of all users for the current tenant.
 * @security Protected by `protect` and `isAdmin` middleware.
 */
exports.getUsers = async (req, res) => {
    try {
        // req.user.tenantId is guaranteed to be present by the 'protect' middleware.
        // This ensures an admin can only see users of their own organization.
        const users = await User.find({ tenantId: req.user.tenantId }, 'name email role index');
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error: Could not retrieve users.' });
    }
};

/**
 * @function updateIndex
 * @description Updates a user's 'index' field by ID, scoped to the current tenant.
 * @security Protected by `protect` middleware.
 */
exports.updateIndex = [
    param('id').isMongoId().withMessage('Invalid User ID format.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { newIndexValue } = req.body;
            const userIdToUpdate = req.params.id;
            const requestingUser = req.user; // from 'protect' middleware

            if (newIndexValue === undefined || (newIndexValue !== 0 && newIndexValue !== 1)) {
                return res.status(400).json({ message: 'A valid new index value (0 or 1) is required.' });
            }

            // An admin can update any user within their tenant.
            // A regular user can only update their own index.
            if (requestingUser.role !== 'admin' && requestingUser.id !== userIdToUpdate) {
                return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
            }

            const updatedUser = await User.findOneAndUpdate(
                { _id: userIdToUpdate, tenantId: requestingUser.tenantId }, // CRITICAL: Scoped to tenant
                { index: newIndexValue },
                { new: true, runValidators: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ message: 'User not found within your organization.' });
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
            res.status(500).json({ message: 'Server error during index update.' });
        }
    }
];


/**
 * @function getUserIndex
 * @description Fetches a specific user's 'index' field by ID, scoped to the current tenant.
 * @security Protected by `protect` and `isAdmin` middleware.
 */
exports.getUserIndex = [
    param('id').isMongoId().withMessage('Invalid User ID format.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const userId = req.params.id;
            const tenantId = req.user.tenantId; // from 'protect' middleware

            const user = await User.findOne({ _id: userId, tenantId }, 'index');

            if (!user) {
                return res.status(404).json({ message: 'User not found within your organization.' });
            }

            if (user.index === undefined || user.index === null) {
                return res.status(404).json({ message: 'User index not set for this user.' });
            }

            res.status(200).json({
                message: 'User index fetched successfully',
                userId: user._id,
                index: user.index
            });

        } catch (error) {
            console.error('Get User Index Error:', error);
            res.status(500).json({ message: 'Server error while fetching user index.' });
        }
    }
];
