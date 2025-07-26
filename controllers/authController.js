const { User, Department, Attendance } = require('../models/User'); // Make sure to export Attendance from your model file
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
const createUser = async (req, res) => { /* ... existing code ... */ };
const getAllUsers = async (req, res) => { /* ... existing code ... */ };
const updateUser = async (req, res) => { /* ... existing code ... */ };
const deleteUser = async (req, res) => { /* ... existing code ... */ };

// --- Department Controllers ---
const createDepartment = async (req, res) => { /* ... existing code ... */ };
const getAllDepartments = async (req, res) => { /* ... existing code ... */ };
const updateDepartment = async (req, res) => { /* ... existing code ... */ };
const deleteDepartment = async (req, res) => { /* ... existing code ... */ };

// --- Attendance Controllers ---

/**
 * @controller checkIn
 * @description Records a user's check-in time for the current day.
 */
const checkIn = async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if already checked in today
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
 * @description Records a user's check-out time and calculates total hours.
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
 * @description Fetches attendance records with filtering by date, employee, and department.
 */
const getAttendanceRecords = async (req, res) => {
    try {
        const { startDate, endDate, employeeId, departmentId } = req.query;

        let query = {};
        
        // Date filtering
        if (startDate || endDate) {
            query.workDate = {};
            if (startDate) query.workDate.$gte = new Date(startDate);
            if (endDate) query.workDate.$lte = new Date(endDate);
        }

        // Employee filtering
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
        });

        // Department filtering (post-query since it's a populated field)
        if (departmentId) {
            attendanceRecords = attendanceRecords.filter(rec => 
                rec.user.department && rec.user.department._id.toString() === departmentId
            );
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
