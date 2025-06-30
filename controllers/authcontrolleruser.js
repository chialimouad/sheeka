const User = require('../models/User'); // Ensure your User model has an 'index' field
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Import bcryptjs for password hashing
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

// Validate that the JWT_SECRET is set for production environments
if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET is not set in environment variables. Using a fallback secret. THIS IS INSECURE FOR PRODUCTION!');
}

/**
 * @desc Generates a JSON Web Token (JWT) for user authentication.
 * @param {string} id - The user's unique ID.
 * @param {string} role - The user's role (e.g., 'admin', 'user').
 * @param {number} index - The user's index value (0 or 1).
 * @returns {string} The generated JWT token.
 */
const generateToken = (id, role, index) => {
    // Use the environment variable for the secret, with a fallback for development/testing
    return jwt.sign({ id, role, index }, process.env.JWT_SECRET || "mouadsecret_fallback_for_dev_only", {
        expiresIn: '28d' // Token expires in 28 days
    });
};

/**
 * @desc Get all users from the database.
 * @route GET /api/users
 * @access Public (or Admin, depending on your middleware)
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.getUsers = async (req, res) => {
    try {
        // Fetch users, selecting only necessary fields for display.
        // Avoid fetching sensitive data like hashed passwords.
        const users = await User.find({}, 'name email role index');
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error.message);
        // Provide a generic error message to the client for security
        res.status(500).json({ message: 'Server error while fetching users.' });
    }
};

/**
 * @desc Register a new user.
 * @route POST /api/auth/register
 * @access Public
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.register = async (req, res) => {
    try {
        const { name, email, password, role, index } = req.body; // Destructure 'index' from body

        // Basic input validation
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'All required fields (name, email, password, role) are missing.' });
        }

        // Validate 'index' if provided. It must be 0 or 1.
        // If not provided, it will default to 0 in the User.create call.
        if (index !== undefined && index !== null && (index !== 0 && index !== 1)) {
            return res.status(400).json({ message: 'Index must be 0 or 1 if provided.' });
        }

        // Check if user already exists (case-insensitive email check)
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        // Create new user. Assuming your User model has a pre-save hook
        // to hash the password before saving it to the database.
        const newUser = await User.create({
            name,
            email: email.toLowerCase(), // Store email in lowercase for consistency
            password, // Password will be hashed by the User model's pre-save hook
            role,
            index: index !== undefined ? index : 0 // Set index, default to 0 (ON) if not provided
        });

        // Generate JWT Token, including the user's index
        const token = generateToken(newUser._id, newUser.role, newUser.index);

        res.status(201).json({
            message: "Registration successful!",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                index: newUser.index // Include index in response
            },
            token
        });

    } catch (error) {
        console.error('Registration Error:', error.message);
        // Provide a generic error message for security
        res.status(500).json({ message: 'Server error during registration. Please try again.' });
    }
};

/**
 * @desc Authenticate user and get token.
 * @route POST /api/auth/login
 * @access Public
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic input validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        // Find user with case-insensitive email
        const user = await User.findOne({ email: email.toLowerCase() });

        // If user not found
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Compare provided password with the hashed password in the database
        // This is the crucial security improvement using bcryptjs
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Generate JWT Token, including the user's index
        const token = generateToken(user._id, user.role, user.index);

        // Send successful login response
        res.status(200).json({
            message: "Login successful!",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                index: user.index // Include index in response
            },
            token
        });

    } catch (error) {
        console.error('Login Error:', error.message);
        // Provide a generic error message for security
        res.status(500).json({ message: 'Server error during login. Please try again.' });
    }
};

/**
 * @desc Update a user's 'index' field.
 * @route PUT /api/users/:id/index
 * @access Private (Admin or User themselves, depending on middleware)
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.updateindex = async (req, res) => {
    try {
        const userId = req.params.id; // Get user ID from URL parameter (e.g., /users/:id/index)
        const { newIndexValue } = req.body; // Get new index value (0 or 1) from the request body

        // Validate newIndexValue
        if (newIndexValue === undefined || (newIndexValue !== 0 && newIndexValue !== 1)) {
            return res.status(400).json({ message: 'A valid new index value (0 or 1) is required.' });
        }

        // Find the User by ID and update their 'index' field
        // 'new: true' returns the updated document
        // 'runValidators: true' ensures schema validators are run on the update
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { index: newIndexValue },
            { new: true, runValidators: true }
        );

        // If user not found
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({
            message: 'User index updated successfully.',
            user: {
                id: updatedUser._id,
                index: updatedUser.index,
                role: updatedUser.role // Include role for consistency
            }
        });

    } catch (error) {
        console.error('Update Index Error:', error.message);
        res.status(500).json({ message: 'Server error during index update. Please try again.' });
    }
};

/**
 * @desc Get a user's 'index' field by user ID.
 * @route GET /api/users/:id/index
 * @access Private (or Public, depending on your needs)
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.getUserIndex = async (req, res) => {
    try {
        const userId = req.params.id; // Get user ID from URL parameter

        // Find the user by ID and select only the 'index' field
        const user = await User.findById(userId, 'index');

        // If user not found
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // If user is found, but for some reason index is missing (should not happen with a well-defined schema)
        if (user.index === undefined || user.index === null) {
            return res.status(404).json({ message: 'User index not found for this user, or it is not set.' });
        }

        res.status(200).json({
            message: 'User index fetched successfully.',
            userId: user._id,
            index: user.index
        });

    } catch (error) {
        console.error('Get User Index Error:', error.message);
        res.status(500).json({ message: 'Server error during fetching user index. Please try again.' });
    }
};
