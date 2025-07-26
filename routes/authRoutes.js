const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Note: The path now points to the new unified controller file
const {
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    getAllDepartments
} = require('../controllers/authController');


// --- User Routes (replaces /api/employees) ---

// @route   POST /api/users
router.post('/users', [
    body('name', 'Name is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required and must be at least 6 characters').isLength({ min: 6 }),
    body('department', 'Department ID must be a valid ID').optional().isMongoId(),
], createUser);

// @route   GET /api/users
router.get('/users', getAllUsers);

// @route   PUT /api/users/:id
router.put('/users/:id', updateUser);

// @route   DELETE /api/users/:id
router.delete('/users/:id', deleteUser);


// --- Department Routes ---

// @route   GET /api/departments
// @desc    Get all departments for the dropdown menu
// @access  Private
router.get('/departments', getAllDepartments);


module.exports = router;
