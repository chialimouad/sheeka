const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Import all the controller functions, including the new attendance functions
const {
    login,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    createDepartment,
    getAllDepartments,
    updateDepartment,
    deleteDepartment,
    checkIn,
    checkOut,
    getAttendanceRecords
} = require('../controllers/authController');

// You will need an authentication middleware to protect routes
// and to get the user ID from the token.
// Example middleware file (e.g., /middleware/authMiddleware.js)
/*
const jwt = require('jsonwebtoken');
module.exports = function(req, res, next) {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_default_jwt_secret');
        req.user = decoded.user;
        next();
    } catch (e) {
        res.status(401).json({ message: 'Token is not valid' });
    }
}
*/
// Assuming the middleware is in a file like the example above:
// const authMiddleware = require('../middleware/authMiddleware');


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


// --- Attendance Routes ---

// @route   POST /auth/attendance/check-in
// @desc    Record user check-in time (Protected Route)
// NOTE: You need to implement and apply authMiddleware for this to work correctly.
router.post('/attendance/check-in', /* authMiddleware, */ checkIn);

// @route   POST /auth/attendance/check-out
// @desc    Record user check-out time (Protected Route)
// NOTE: You need to implement and apply authMiddleware for this to work correctly.
router.post('/attendance/check-out', /* authMiddleware, */ checkOut);

// @route   GET /auth/attendance
// @desc    Get attendance records with filters (Protected Route)
// NOTE: You need to implement and apply authMiddleware for this to work correctly.
router.get('/attendance', /* authMiddleware, */ getAttendanceRecords);


module.exports = router;
