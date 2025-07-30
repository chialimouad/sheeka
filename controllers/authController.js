// Import necessary modules
const User = require('../models/User'); // Ensure your User model has an 'index' field and bcrypt methods
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs'); // For password hashing
const { validationResult } = require('express-validator'); // For robust input validation

// Load environment variables from .env file
dotenv.config();

// --- Helper Functions ---

/**
 * @function generateToken
 * @description Generates a JSON Web Token (JWT) for a user.
 * @param {string} id - The user's unique ID.
 * @param {string} role - The user's role (e.g., 'user', 'admin').
 * @param {number} index - The user's custom index (0 or 1).
 * @returns {string} The generated JWT.
 */
const generateToken = (id, role, index) => {
    // IMPORTANT: Use a strong, truly secret key from environment variables.
    // The fallback "mouadsecret_fallback" is for development only and should NEVER be used in production.
    if (!process.env.JWT_SECRET) {
        console.warn('WARNING: JWT_SECRET is not set in environment variables. Using a fallback secret. THIS IS INSECURE FOR PRODUCTION!');
    }
    return jwt.sign({ id, role, index }, process.env.JWT_SECRET || "mouadsecret_fallback", { expiresIn: '28d' });
};

// --- Controller Functions ---

/**
 * @function getUsers
 * @description Fetches a list of all users.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 * @security This endpoint should typically be protected by authentication and authorization middleware
 * to ensure only authorized users (e.g., admins) can access all user data.
 */
exports.getUsers = async (req, res) => {
    try {
        // Fetch users, explicitly selecting only necessary fields to avoid sending sensitive data.
        // The 'index' field is included as per your original requirement.
        const users = await User.find({}, 'name email role index');
        res.status(200).json(users);
    } catch (error) {
        // Log the full error for debugging but send a generic message to the client.
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error: Could not retrieve users.' });
    }
};

/**
 * @function register
 * @description Handles user registration, including input validation and password hashing.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
exports.register = async (req, res) => {
    // Validate request body using express-validator results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, email, password, role, index } = req.body;

        // Check if user already exists (case-insensitive email)
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists.' }); // 409 Conflict is more appropriate
        }

        // Hash the password before saving. This should ideally be done in a pre-save hook in your Mongoose User model.
        // For demonstration, I'm showing it here, but the model hook is preferred.
        const salt = await bcrypt.genSalt(10); // Generate a salt
        const hashedPassword = await bcrypt.hash(password, salt); // Hash the password

        // Assign a default index of 0 if not provided during registration.
        // Ensure 'index' is explicitly cast to a number if it comes from the body as a string.
        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword, // Store the hashed password
            role,
            index: typeof index === 'number' ? index : 0 // Default to 0 if not provided or invalid type
        });

        // Generate JWT Token, now including the user's index
        const token = generateToken(newUser._id, newUser.role, newUser.index);

        res.status(201).json({
            message: "Registration successful",
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
        console.error('Registration Error:', error);
        // Provide a more generic error message to prevent leaking internal details
        res.status(500).json({ message: 'Server error during registration. Please try again later.' });
    }
};

/**
 * @function login
 * @description Handles user login, including password comparison and JWT generation.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
exports.login = async (req, res) => {
    // Validate request body using express-validator results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;

        // Find user with case-insensitive email
        const user = await User.findOne({ email: email.toLowerCase() });

        // If user not found or password does not match, return generic 'Invalid credentials'
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Compare provided password with hashed password using bcrypt
        // This assumes your User model has a method like `comparePassword` or you hash here.
        // If your User model has a `comparePassword` method (recommended):
        // const isMatch = await user.comparePassword(password);
        // Otherwise, compare using bcrypt directly:
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT Token, now including the user's index
        const token = generateToken(user._id, user.role, user.index);

        // Send successful login response
        res.status(200).json({
            message: "Login successful",
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
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Server error during login. Please try again later.' });
    }
};

/**
 * @function updateindex
 * @description Updates a user's 'index' field by ID.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 * @security This endpoint should be protected by authentication and authorization middleware.
 * Only the user themselves or an admin should be able to update their index.
 */
exports.updateindex = async (req, res) => {
    // Validate request body using express-validator results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const userId = req.params.id; // Get user ID from URL parameter
        const { newIndexValue } = req.body; // Get new index value (0 or 1) from the request body

        // Optional: Add authorization check here.
        // Example: if (req.user.id !== userId && req.user.role !== 'admin') { return res.status(403).json({ message: 'Forbidden' }); }

        // Find the User by ID and update their 'index' field
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { index: newIndexValue },
            { new: true, runValidators: true } // Return the updated document and run schema validators
        );

        // If user not found
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({
            message: 'User index updated successfully',
            user: {
                id: updatedUser._id,
                index: updatedUser.index,
                role: updatedUser.role // Include role for consistency
            }
        });

    } catch (error) {
        console.error('Update Index Error:', error);
        res.status(500).json({ message: 'Server error during index update. Please try again later.' });
    }
};

/**
 * @function getUserIndex
 * @description Fetches a specific user's 'index' field by ID.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 * @security This endpoint should be protected by authentication and authorization middleware.
 * Consider if any authenticated user can view any other user's index, or if it's restricted.
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

        // If user is found, but for some reason index is missing (should not happen with a proper schema)
        if (user.index === undefined || user.index === null) {
            // This case indicates a data integrity issue if 'index' is mandatory.
            return res.status(404).json({ message: 'User index not found for this user.' });
        }

        res.status(200).json({
            message: 'User index fetched successfully',
            userId: user._id,
            index: user.index
        });

    } catch (error) {
        console.error('Get User Index Error:', error);
        res.status(500).json({ message: 'Server error during fetching user index. Please try again later.' });
    }
};
