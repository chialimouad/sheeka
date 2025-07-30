const { User, Department } = require('../models/User'); // Removed 'Attendance'
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Auth Controller ---
const login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const payload = { user: { id: user.id, role: user.role } };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your_default_jwt_secret',
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                const userResponse = user.toObject();
                delete userResponse.password;
                res.json({ token, user: userResponse });
            }
        );
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server error');
    }
};

// --- User Controllers ---
exports.createUser = async (req, res) => {
    // 1. Run validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // 2. Destructure ALL fields from the request body, including 'role'
    const { name, email, password, jobTitle, department, manager, employmentStatus, role } = req.body;

    try {
        // 3. Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // 4. Create a new user instance, making sure to include the 'role'
        user = new User({
            name,
            email,
            password,
            jobTitle,
            department: department || null,
            manager: manager || null,
            employmentStatus,
            role // This is the crucial part that was likely missing
        });

        // 5. Save the new user to the database
        await user.save();
        
        // 6. Respond with success (you can also generate and return a JWT token here if needed)
        res.status(201).json({ message: 'User created successfully', userId: user.id });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).populate('department', 'name description').populate('manager', 'name email');
        res.status(200).json(users);
    } catch (error) {
        console.error('Get All Users Error:', error);
        res.status(500).json({ message: 'Server error while retrieving users.' });
    }
};

const updateUser = async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.password;
        const updatedUser = await User.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true, runValidators: true })
            .populate('department', 'name description').populate('manager', 'name email');
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        console.error('Update User Error:', error);
        res.status(500).json({ message: 'Server error during user update.' });
    }
};

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
        const updatedDepartment = await Department.findByIdAndUpdate(req.params.id, { name, description }, { new: true, runValidators: true });
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
    login,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    createDepartment,
    getAllDepartments,
    updateDepartment,
    deleteDepartment
};
