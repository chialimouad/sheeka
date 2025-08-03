/**
 * FILE: ./controllers/authController.js
 * DESC: Authentication-related controller functions.
 *
 * MODIFIED: The 'login' function has been updated with improved error handling
 * and detailed logging to diagnose issues with tenant identification. It now
 * explicitly checks for the presence of the 'tenant' object from the
 * middleware before proceeding.
 */
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs'); // Ensure you're importing bcrypt
const User = require('../models/User'); // Assuming a global User model
const { generateToken } = require('../utils/token'); // Assuming token generation is in a utility file

// --- Your other controller functions (register, checkEmail, etc.) ---
// (Make sure your register function is correctly saving the tenantId to the user)
exports.register = async (req, res) => {
    // ... (validation logic)

    try {
        const { name, email, password } = req.body;
        const { tenant } = req; // This MUST be populated by your identifyTenant middleware

        // CRITICAL CHECK: Ensure tenant was identified for registration
        if (!tenant || !tenant.tenantId) {
            console.error('Registration Error: Tenant could not be identified.');
            return res.status(500).json({ message: 'Server configuration error: Could not identify tenant.' });
        }

        // Check if user already exists for this tenant
        let user = await User.findOne({ email, tenantId: tenant.tenantId });
        if (user) {
            return res.status(400).json({ message: 'User already exists for this tenant.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user with the tenantId
        user = new User({
            name,
            email,
            password: hashedPassword,
            tenantId: tenant.tenantId, // <-- Make sure you are saving this!
            role: 'user' // Default role
        });

        await user.save();

        // ... (rest of your registration logic, maybe generate a token)

        res.status(201).json({ message: 'User registered successfully.' });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};


// --- REVISED LOGIN FUNCTION ---
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        // These are populated by the identifyTenant middleware that MUST run before this route.
        const { tenant, jwtSecret } = req;

        // --- Step 1: Add Detailed Logging & Tenant Check ---
        console.log('--- LOGIN ATTEMPT ---');
        console.log('Looking for tenant:', req.hostname); // Log which tenant is being accessed
        
        // CRITICAL CHECK: This is the most likely point of failure.
        if (!tenant || !tenant.tenantId || !jwtSecret) {
            console.error('LOGIN ERROR: Tenant identification failed. The `tenant` or `jwtSecret` object was not found on the request. Check that your `identifyTenant` middleware is correctly configured for the /login route.');
            return res.status(500).json({ message: 'Server configuration error: Could not identify tenant.' });
        }
        
        console.log(`Tenant identified: ${tenant.name} (ID: ${tenant.tenantId})`);

        // --- Step 2: Find the User within the Correct Tenant ---
        console.log(`Querying for user with email: "${email}" in tenantId: ${tenant.tenantId}`);
        const user = await User.findOne({ email, tenantId: tenant.tenantId });

        if (!user) {
            console.log('Login Failure: No user found with the provided email for this specific tenant.');
            // Return a generic message to avoid revealing whether the email exists.
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        console.log(`User found: ${user.email}`);

        // --- Step 3: Compare Passwords ---
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`Login Failure: Password mismatch for user: ${user.email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // --- Step 4: Generate Token and Respond ---
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
        // This will catch any unexpected errors (e.g., database connection issues)
        console.error('A critical error occurred in the login controller:', error);
        res.status(500).json({ message: 'Login failed due to a server error.' });
    }
};

// --- Your other controller functions (getUserIndex, updateIndex, etc.) ---
exports.getUserIndex = (req, res) => { /* ... your logic ... */ };
exports.updateIndex = (req, res) => { /* ... your logic ... */ };
exports.getUsers = (req, res) => { /* ... your logic ... */ };
