// Import the User model and validation tools
const User = require('../models/User'); // Adjust the path to your User model
const { validationResult } = require('express-validator');

// --- User/Employee Controller Functions ---

/**
 * @controller createUser
 * @description Creates a new user/employee.
 * @route POST /api/users
 * @access Private (Admin)
 */
const createUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            name,
            email,
            password, // Password will be hashed by the pre-save middleware in the model
            jobTitle,
            department,
            manager, // Expecting a User ObjectId for the manager
            employmentStatus,
            contractType,
            role,
            documents // Optional: array of document objects
        } = req.body;

        // 1. Check if a user with the same email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        // 2. (Optional but recommended) If a manager is provided, check if they exist
        if (manager) {
            const managerExists = await User.findById(manager);
            if (!managerExists) {
                return res.status(400).json({ message: 'Invalid Manager ID.' });
            }
        }

        // 3. Create the new user
        const newUser = await User.create({
            name,
            email,
            password,
            jobTitle,
            department,
            manager,
            employmentStatus,
            contractType,
            role,
            documents
        });
        
        // Exclude password from the response object
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
 * @route GET /api/users
 * @access Private
 */
const getAllUsers = async (req, res) => {
    try {
        // Populate 'manager' to show the manager's name
        const users = await User.find({})
            .populate('manager', 'name email'); // Select name and email from the User (manager)

        res.status(200).json(users);
    } catch (error) {
        console.error('Get All Users Error:', error);
        res.status(500).json({ message: 'Server error while retrieving users.' });
    }
};

/**
 * @controller getUserById
 * @description Fetches a single user by their ID.
 * @route GET /api/users/:id
 * @access Private
 */
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('manager', 'name email');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Get User By ID Error:', error);
        res.status(500).json({ message: 'Server error while retrieving user.' });
    }
};

/**
 * @controller updateUser
 * @description Updates a user's details.
 * @route PUT /api/users/:id
 * @access Private (Admin)
 */
const updateUser = async (req, res) => {
    try {
        const {
            name,
            email,
            jobTitle,
            department,
            manager,
            employmentStatus,
            contractType,
            role
        } = req.body;

        // Construct the update object dynamically
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email.toLowerCase();
        if (jobTitle) updateData.jobTitle = jobTitle;
        if (department) updateData.department = department;
        if (manager) updateData.manager = manager;
        if (employmentStatus) updateData.employmentStatus = employmentStatus;
        if (contractType) updateData.contractType = contractType;
        if (role) updateData.role = role;


        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('manager', 'name email');

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
 * @route DELETE /api/users/:id
 * @access Private (Admin)
 */
const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Optional: Add logic here to handle cascading actions, 
        // e.g., reassigning their direct reports who had this user as a manager.

        res.status(200).json({ message: 'User deleted successfully' });

    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ message: 'Server error during user deletion.' });
    }
};

/**
 * @controller addDocumentToUser
 * @description Adds a document to a user's profile.
 * @route POST /api/users/:id/documents
 * @access Private (Admin)
 */
const addDocumentToUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        // Matches the DocumentSchema: documentName and documentUrl
        const { documentName, documentUrl } = req.body; 
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.documents.push({ documentName, documentUrl });
        await user.save();

        res.status(200).json({
            message: 'Document added successfully',
            user
        });

    } catch (error) {
        console.error('Add Document Error:', error);
        res.status(500).json({ message: 'Server error while adding document.' });
    }
};


// Export all controller functions
module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    addDocumentToUser
};
