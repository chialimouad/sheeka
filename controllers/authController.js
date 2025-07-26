const { User, Department } = require('../models/User');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- User Controllers ---

/**
 * @controller login
 * @description Authenticates a user and returns a JWT token.
 */
const login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // Find user by email, and explicitly select the password field which is hidden by default
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check if the provided password matches the stored hashed password
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT Payload
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        // Sign the token
        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your_default_jwt_secret', // Use an environment variable for your secret in production
            { expiresIn: '5h' }, // Token expires in 5 hours
            (err, token) => {
                if (err) throw err;
                // Return the token and user info (without password) to the client
                const userResponse = user.toObject();
                delete userResponse.password;

                res.json({
                    token,
                    user: userResponse
                });
            }
        );

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server error');
    }
};


/**
 * @controller createUser
 * @description Creates a new user/employee.
 */
const createUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, email, password, jobTitle, department, manager, employmentStatus } = req.body;

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        const newUser = await User.create({
            name,
            email,
            password,
            jobTitle,
            department,
            manager,
            employmentStatus
        });
        
        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: 'User created successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Create User Error:', error);
        res.status(500).json({ message: 'Server error during user creation.' });
    }
};

/**
 * @controller getAllUsers
 * @description Fetches a list of all users/employees.
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({})
            .populate('department', 'name description')
            .populate('manager', 'name email');

        res.status(200).json(users);
    } catch (error) {
        console.error('Get All Users Error:', error);
        res.status(500).json({ message: 'Server error while retrieving users.' });
    }
};

/**
 * @controller updateUser
 * @description Updates a user's details.
 */
const updateUser = async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.password;

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('department', 'name description').populate('manager', 'name email');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User updated successfully', user: updatedUser });

    } catch (error) {
        console.error('Update User Error:', error);
        res.status(500).json({ message: 'Server error during user update.' });
    }
};

/**
 * @controller deleteUser
 * @description Deletes a user by their ID.
 */
const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ message: 'Server error during user deletion.' });
    }
};


// --- Department Controllers ---

const createDepartment = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { name, description } = req.body;
        const existingDepartment = await Department.findOne({ name });
        if (existingDepartment) {
            return res.status(409).json({ message: 'A department with this name already exists.' });
        }
        const newDepartment = await Department.create({ name, description });
        res.status(201).json(newDepartment);
    } catch (error) {
        res.status(500).json({ message: 'Server error during department creation.' });
    }
};

const getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.find({});
        res.status(200).json(departments);
    } catch (error) {
        res.status(500).json({ message: 'Server error while retrieving departments.' });
    }
};

const updateDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;
        const updatedDepartment = await Department.findByIdAndUpdate(
            req.params.id,
            { name, description },
            { new: true, runValidators: true }
        );
        if (!updatedDepartment) {
            return res.status(404).json({ message: 'Department not found.' });
        }
        res.status(200).json({ message: 'Department updated successfully', department: updatedDepartment });
    } catch (error) {
        res.status(500).json({ message: 'Server error during department update.' });
    }
};

const deleteDepartment = async (req, res) => {
    try {
        const department = await Department.findByIdAndDelete(req.params.id);
        if (!department) {
            return res.status(404).json({ message: 'Department not found.' });
        }
        res.status(200).json({ message: 'Department deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during department deletion.' });
    }
};


module.exports = {
    login, // Export the new login function
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    createDepartment,
    getAllDepartments,
    updateDepartment,
    deleteDepartment
};
