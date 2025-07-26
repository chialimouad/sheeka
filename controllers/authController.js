// Note: The path now points to the new unified model file
const { User, Department } = require('../models/User'); 
const { validationResult } = require('express-validator');

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
            .populate('department', 'name')
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
        // Remove password from body to prevent accidental update this way
        delete updateData.password; 

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('department', 'name').populate('manager', 'name email');

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

/**
 * @controller getAllDepartments
 * @description Fetches all departments.
 */
const getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.find({});
        res.status(200).json(departments);
    } catch (error) {
        console.error('Get All Departments Error:', error);
        res.status(500).json({ message: 'Server error while retrieving departments.' });
    }
};


module.exports = {
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    getAllDepartments
};
