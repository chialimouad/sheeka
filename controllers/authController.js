// =================================================================
// FILE: ./controllers/authController.js
// This is the controller code you provided. It appears to be correct.
// The error is not in this file, but in how it's being used.
// =================================================================

const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT token
const generateToken = (userId, tenantId, role, jwtSecret) => {
    return jwt.sign(
        { id: userId, tenantId, role },
        jwtSecret,
        { expiresIn: '28d' }
    );
};

// Check email availability
exports.checkEmail = async (req, res) => {
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const { tenant, jwtSecret } = req;

        // Find user
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

// Get all users
exports.getUsers = async (req, res) => {
    try {
        const users = await req.tenant.model('User').find(
            {},
            'name email role index createdAt'
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

// Get user index
exports.getUserIndex = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await req.tenant.model('User').findById(
            req.params.id,
            'index'
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

// Update user index
exports.updateIndex = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { newIndexValue } = req.body;
        const { id } = req.params;
        const { user: requester, tenant } = req;

        // Authorization check
        if (requester.role !== 'admin' && requester.id !== id) {
            return res.status(403).json({ 
                message: 'Not authorized to update this user' 
            });
        }

        const updatedUser = await tenant.model('User').findByIdAndUpdate(
            id,
            { index: newIndexValue },
            { new: true, select: '_id index role' }
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


// =================================================================
// FILE: ./routes/authRoutes.js (THE FIX IS HERE)
// Create this file to define your routes. It imports the controller
// and wires each function to a specific route and HTTP method.
// =================================================================

const express = require('express');
const { body, param } = require('express-validator');
const authController = require('../controllers/authController'); // Adjust path if needed

// You would likely have some middleware to protect routes
// This is a placeholder for what that might look like.
const protect = (req, res, next) => { /* Your JWT verification logic here */ next(); };
const admin = (req, res, next) => { /* Your admin role check logic here */ next(); };


const router = express.Router();

// Route for checking email availability
// POST /api/auth/check-email
router.post(
    '/check-email',
    [
        body('email', 'Please enter a valid email.').isEmail().normalizeEmail()
    ],
    authController.checkEmail
);

// Route for user registration
// POST /api/auth/register
router.post(
    '/register',
    [
        body('name', 'Name is required.').trim().not().isEmpty(),
        body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
        body('password', 'Password must be at least 6 characters.').isLength({ min: 6 })
    ],
    authController.register
);

// Route for user login
// POST /api/auth/login
router.post(
    '/login',
    [
        body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
        body('password', 'Password is required.').not().isEmpty()
    ],
    authController.login
);

// Route to get all users (protected for admins)
// GET /api/auth/users
router.get('/users', protect, admin, authController.getUsers);

// Route to get a specific user's index
// GET /api/auth/users/:id/index
router.get(
    '/users/:id/index',
    [
        param('id', 'Invalid user ID').isMongoId()
    ],
    protect, 
    authController.getUserIndex
);

// Route to update a user's index
// PUT /api/auth/users/:id/index
router.put(
    '/users/:id/index',
    [
        param('id', 'Invalid user ID').isMongoId(),
        body('newIndexValue', 'Index value must be a number.').isNumeric()
    ],
    protect,
    authController.updateIndex
);

// !!! IMPORTANT !!!
// Export the configured router object. This is what server.js will use.
module.exports = router;


// =================================================================
// FILE: ./server.js (Relevant Snippet)
// This shows how to correctly use the authRoutes.js file.
// =================================================================

const express = require('express');
const authRoutes = require('./routes/authRoutes'); // <-- Import the ROUTER, not the controller

const app = express();

// Add middleware to parse JSON bodies
app.use(express.json());

// ... other app.use() middleware ...

// CORRECT USAGE:
// Use the router for any requests that start with /api/auth
// Express receives the `router` object from authRoutes.js, which is valid.
app.use('/api/auth', authRoutes);

// INCORRECT USAGE (This is what causes the error):
// const authController = require('./controllers/authController');
// app.use('/api/auth', authController); // <-- This is WRONG because authController is an object of functions, not a single middleware.

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
