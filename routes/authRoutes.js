const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Assuming your controller file is named 'employeeController.js'
const {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee,
    addDocumentToEmployee,
    assignConfirmationHandler,
    assignStockAdmin
} = require('../controllers/authController');

// You would typically have an auth middleware to protect these routes
// const { protect, admin } = require('../middleware/authMiddleware');


// --- Employee Routes ---

// @route   POST api/employees
// @desc    Create a new employee
// @access  Private/Admin
router.post('/', [
    // Validation middleware
    body('firstName', 'First name is required').not().isEmpty(),
    body('lastName', 'Last name is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('department', 'Department ID is required').isMongoId(),
], createEmployee);

// @route   GET api/employees
// @desc    Get all employees
// @access  Private
router.get('/', getAllEmployees);

// @route   GET api/employees/:id
// @desc    Get a single employee by ID
// @access  Private
router.get('/:id', getEmployeeById);

// @route   PUT api/employees/:id
// @desc    Update an employee
// @access  Private/Admin
router.put('/:id', updateEmployee);

// @route   DELETE api/employees/:id
// @desc    Delete an employee
// @access  Private/Admin
router.delete('/:id', deleteEmployee);


// --- Employee Document Routes ---

// @route   POST api/employees/:id/documents
// @desc    Add a document to an employee
// @access  Private/Admin
router.post('/:id/documents', [
    body('name', 'Document name is required').not().isEmpty(),
    body('url', 'Document URL is required').not().isEmpty(),
], addDocumentToEmployee);


// --- Assignment Routes ---

// @route   PUT api/verifications/:verificationId/assign
// @desc    Assign an employee to a verification request
// @access  Private/Admin
router.put('/verifications/:verificationId/assign', assignConfirmationHandler);

// @route   PUT api/stock-grants/:grantId/assign
// @desc    Assign an employee to a stock grant
// @access  Private/Admin
router.put('/stock-grants/:grantId/assign', assignStockAdmin);


module.exports = router;
