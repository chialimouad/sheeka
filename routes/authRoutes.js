const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Import all the controller functions, including the new login function
const {
    login,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    createDepartment,
    getAllDepartments,
    updateDepartment,
    deleteDepartment
} = require('../controllers/authController');


// --- Auth Route ---

// @route    POST /auth/login
// @desc     Authenticate user & get token
router.post('/login', [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists()
], login);


// --- User Routes ---

// @route    POST /auth/users
router.post('/users', [
    body('name', 'Name is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
], createUser);

// @route    GET /auth/users
router.get('/users', getAllUsers);

// @route    PUT /auth/users/:id
router.put('/users/:id', updateUser);

// @route    DELETE /auth/users/:id
router.delete('/users/:id', deleteUser);


// --- Department Routes ---

// @route    POST /auth/departments
router.post('/departments', [
    body('name', 'Department name is required').not().isEmpty(),
], createDepartment);

// @route    GET /auth/departments
router.get('/departments', getAllDepartments);

// @route    PUT /auth/departments/:id
router.put('/departments/:id', [
    body('name', 'Department name is required').not().isEmpty(),
], updateDepartment);

// @route    DELETE /auth/departments/:id
router.delete('/departments/:id', deleteDepartment);


module.exports = router;
