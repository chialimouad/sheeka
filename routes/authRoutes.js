/**
 * FILE: ./routes/authRoutes.js
 * DESC: This file defines the API endpoints for authentication and maps them
 * to the corresponding controller functions. This configured router is
 * what gets exported and used in server.js.
 */
const express = require('express');
const { body, param } = require('express-validator');
const authController = require('../controllers/authController');

// This is a placeholder for your actual JWT authentication middleware.
// You would replace the comment with your logic to verify the token.
const protect = (req, res, next) => {
    // Example: verify(req.headers.authorization, process.env.JWT_SECRET)
    console.log('Route is protected.');
    next(); 
};

// This is a placeholder for your admin role-checking middleware.
const admin = (req, res, next) => {
    // Example: if (req.user.role !== 'admin') { return res.status(403).send(...) }
    console.log('Route requires admin privileges.');
    next();
};

// Create a new router instance
const router = express.Router();

// Route for checking email availability
// Handles POST requests to /api/auth/check-email
router.post(
    '/check-email',
    [
        body('email', 'Please enter a valid email.').isEmail().normalizeEmail()
    ],
    authController.checkEmail
);

// Route for user registration
// Handles POST requests to /api/auth/register
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
// Handles POST requests to /api/auth/login
router.post(
    '/login',
    [
        body('email', 'Please enter a valid email.').isEmail().normalizeEmail(),
        body('password', 'Password is required.').not().isEmpty()
    ],
    authController.login
);

// Route to get all users (protected for admins)
// Handles GET requests to /api/auth/users
router.get('/users', protect, admin, authController.getUsers);

// Route to get a specific user's index (protected)
// Handles GET requests to /api/auth/users/:id/index
router.get(
    '/users/:id/index',
    [
        param('id', 'Invalid user ID').isMongoId()
    ],
    protect, 
    authController.getUserIndex
);

// Route to update a user's index (protected)
// Handles PUT requests to /api/auth/users/:id/index
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
