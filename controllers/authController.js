const { User, Department, Attendance } = require('../models/User'); // Ensure Attendance is imported
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');


// --- Authentication Controller ---

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
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your_default_jwt_secret',
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
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

// --- User Controllers ---

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
        const newUser = await User.create({ name, email, password, jobTitle, department, manager, employmentStatus });
        const userResponse = newUser.toObject();
        delete userResponse.password;
        res.status(201).json({ message: 'User created successfully', user: userResponse });
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
        const users = await User.find({}).populate('department', 'name description').populate('manager', 'name email');
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


// --- Attendance Controllers ---

/**
 * @controller checkIn
 * @description Records a user's check-in time for the current day.
 */
const checkIn = async (req, res) => {
    try {
        const userId = req.user.id; // Assumes auth middleware adds user to req
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingAttendance = await Attendance.findOne({ user: userId, workDate: today });
        if (existingAttendance) {
            return res.status(400).json({ message: 'You have already checked in today.' });
        }

        const newAttendance = new Attendance({
            user: userId,
            checkIn: new Date(),
            workDate: today
        });

        await newAttendance.save();
        res.status(201).json({ message: 'Checked in successfully.', attendance: newAttendance });
    } catch (error) {
        console.error('Check-in Error:', error);
        res.status(500).json({ message: 'Server error during check-in.' });
    }
};

/**
 * @controller checkOut
 * @description Records a user's check-out time.
 */
const checkOut = async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await Attendance.findOne({ user: userId, workDate: today });
        if (!attendance) {
            return res.status(404).json({ message: 'No check-in record found for today.' });
        }
        if (attendance.checkOut) {
            return res.status(400).json({ message: 'You have already checked out today.' });
        }

        attendance.checkOut = new Date();
        await attendance.save();
        res.status(200).json({ message: 'Checked out successfully.', attendance });
    } catch (error) {
        console.error('Check-out Error:', error);
        res.status(500).json({ message: 'Server error during check-out.' });
    }
};

/**
 * @controller getAttendanceRecords
 * @description Fetches attendance records with filtering.
 */
const getAttendanceRecords = async (req, res) => {
    try {
        const { startDate, endDate, employeeId, departmentId } = req.query;
        let query = {};
        
        if (startDate || endDate) {
            query.workDate = {};
            if (startDate) query.workDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // Include the whole end day
                query.workDate.$lte = end;
            }
        }

        if (employeeId) {
            query.user = employeeId;
        }

        let attendanceRecords = await Attendance.find(query).populate({
            path: 'user',
            select: 'name email department',
            populate: {
                path: 'department',
                select: 'name'
            }
        }).sort({ workDate: -1 });

        if (departmentId) {
            attendanceRecords = attendanceRecords.filter(rec => rec.user.department && rec.user.department._id.toString() === departmentId);
        }

        res.status(200).json(attendanceRecords);
    } catch (error) {
        console.error('Get Attendance Error:', error);
        res.status(500).json({ message: 'Server error while retrieving attendance records.' });
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
    deleteDepartment,
    checkIn,
    checkOut,
    getAttendanceRecords
};
