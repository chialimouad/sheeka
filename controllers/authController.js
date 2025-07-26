// Import necessary models from your models file
const { Employee, Department, EmploymentVerification, StockGrant } = require('../models/User'); // Adjust the path as needed
const { validationResult } = require('express-validator');

// --- Employee Controller Functions ---

/**
 * @controller createEmployee
 * @description Creates a new employee.
 * @route POST /api/employees
 * @access Private (Admin/HR)
 */
const createEmployee = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            firstName,
            lastName,
            email,
            jobTitle,
            hireDate,
            employmentStatus,
            department, // Expecting a Department ObjectId
            manager, // Expecting an Employee ObjectId
            documents
        } = req.body;

        // 1. Check if an employee with the same email already exists
        const existingEmployee = await Employee.findOne({ email: email.toLowerCase() });
        if (existingEmployee) {
            return res.status(409).json({ message: 'An employee with this email already exists.' });
        }

        // 2. (Optional but recommended) Check if the provided department exists
        const departmentExists = await Department.findById(department);
        if (!departmentExists) {
            return res.status(400).json({ message: 'Invalid Department ID.' });
        }

        // 3. Create the new employee
        const newEmployee = await Employee.create({
            firstName,
            lastName,
            email,
            jobTitle,
            hireDate,
            employmentStatus,
            department,
            manager,
            documents
        });

        res.status(201).json({
            message: 'Employee created successfully',
            employee: newEmployee
        });

    } catch (error) {
        console.error('Create Employee Error:', error);
        res.status(500).json({ message: 'Server error during employee creation.' });
    }
};

/**
 * @controller getAllEmployees
 * @description Fetches a list of all employees.
 * @route GET /api/employees
 * @access Private
 */
const getAllEmployees = async (req, res) => {
    try {
        // Populate 'department' to show department name, and 'manager' to show manager's name
        const employees = await Employee.find({})
            .populate('department', 'name') // Select only the 'name' field from the Department
            .populate('manager', 'firstName lastName'); // Select name fields from the Employee (manager)

        res.status(200).json(employees);
    } catch (error) {
        console.error('Get All Employees Error:', error);
        res.status(500).json({ message: 'Server error while retrieving employees.' });
    }
};

/**
 * @controller getEmployeeById
 * @description Fetches a single employee by their ID.
 * @route GET /api/employees/:id
 * @access Private
 */
const getEmployeeById = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id)
            .populate('department', 'name')
            .populate('manager', 'firstName lastName');

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found.' });
        }

        res.status(200).json(employee);
    } catch (error) {
        console.error('Get Employee By ID Error:', error);
        res.status(500).json({ message: 'Server error while retrieving employee.' });
    }
};

/**
 * @controller updateEmployee
 * @description Updates an employee's details.
 * @route PUT /api/employees/:id
 * @access Private (Admin/HR)
 */
const updateEmployee = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            jobTitle,
            employmentStatus,
            department,
            manager
        } = req.body;

        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (email) updateData.email = email.toLowerCase();
        if (jobTitle) updateData.jobTitle = jobTitle;
        if (employmentStatus) updateData.employmentStatus = employmentStatus;
        if (department) updateData.department = department;
        if (manager) updateData.manager = manager;

        const updatedEmployee = await Employee.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedEmployee) {
            return res.status(404).json({ message: 'Employee not found.' });
        }

        res.status(200).json({ message: 'Employee updated successfully', employee: updatedEmployee });

    } catch (error) {
        console.error('Update Employee Error:', error);
        res.status(500).json({ message: 'Server error during employee update.' });
    }
};

/**
 * @controller deleteEmployee
 * @description Deletes an employee by their ID.
 * @route DELETE /api/employees/:id
 * @access Private (Admin/HR)
 */
const deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found.' });
        }

        // Optional: Add logic here to handle cascading deletes, e.g., reassigning their direct reports.

        res.status(200).json({ message: 'Employee deleted successfully' });

    } catch (error) {
        console.error('Delete Employee Error:', error);
        res.status(500).json({ message: 'Server error during employee deletion.' });
    }
};

/**
 * @controller addDocumentToEmployee
 * @description Adds a document to an employee's profile.
 * @route POST /api/employees/:id/documents
 * @access Private (Admin/HR)
 */
const addDocumentToEmployee = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, url } = req.body; // Document name and URL (e.g., from a file upload service)
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found.' });
        }

        employee.documents.push({ name, url });
        await employee.save();

        res.status(200).json({
            message: 'Document added successfully',
            employee
        });

    } catch (error) {
        console.error('Add Document Error:', error);
        res.status(500).json({ message: 'Server error while adding document.' });
    }
};

/**
 * @controller assignConfirmationHandler
 * @description Assigns an employee to handle a confirmation service request.
 * @route PUT /api/verifications/:verificationId/assign
 * @access Private (Admin/HR)
 */
const assignConfirmationHandler = async (req, res) => {
    try {
        const { verificationId } = req.params;
        const { employeeId } = req.body;

        const verificationRequest = await EmploymentVerification.findById(verificationId);
        if (!verificationRequest) {
            return res.status(404).json({ message: 'Employment verification request not found.' });
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee to assign not found.' });
        }

        verificationRequest.processedBy = employeeId;
        await verificationRequest.save();

        res.status(200).json({ message: 'Employee assigned to confirmation request successfully.', verificationRequest });

    } catch (error) {
        console.error('Assign Confirmation Handler Error:', error);
        res.status(500).json({ message: 'Server error while assigning employee.' });
    }
};

/**
 * @controller assignStockAdmin
 * @description Assigns an employee to manage a stock grant.
 * @route PUT /api/stock-grants/:grantId/assign
 * @access Private (Admin/HR)
 */
const assignStockAdmin = async (req, res) => {
    try {
        const { grantId } = req.params;
        const { employeeId } = req.body;

        const stockGrant = await StockGrant.findById(grantId);
        if (!stockGrant) {
            return res.status(404).json({ message: 'Stock grant not found.' });
        }
        
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee to assign not found.' });
        }

        stockGrant.administeredBy = employeeId;
        await stockGrant.save();

        res.status(200).json({ message: 'Employee assigned to stock grant successfully.', stockGrant });

    } catch (error) {
        console.error('Assign Stock Admin Error:', error);
        res.status(500).json({ message: 'Server error while assigning employee.' });
    }
};


// Export all controller functions
module.exports = {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee,
    addDocumentToEmployee,
    assignConfirmationHandler, // NEW
    assignStockAdmin // NEW
};
