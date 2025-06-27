const User = require('../models/User'); // Ensure your User model has an 'index' field
// const AdminCredential = require('../models/admin'); // Removed: AdminCredential is not used for user index updates
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

// ✅ Generate JWT Token - now includes 'index'
const generateToken = (id, role, index) => { // Added 'index' parameter
  // It's highly recommended to use an environment variable for your JWT secret
  // process.env.JWT_SECRET should be set in your .env file
  return jwt.sign({ id, role, index }, process.env.JWT_SECRET || "mouadsecret_fallback", { expiresIn: '28d' });
};

exports.getUsers = async (req, res) => {
  try {
    // Fetch users including the 'index' field for potential admin panel display
    const users = await User.find({}, 'name email role index');
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Register Controller - now handles 'index'
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, index } = req.body; // Destructure 'index' from body

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    // Validate 'index' if provided, must be 0 or 1
    if (index !== undefined && index !== null && (index !== 0 && index !== 1)) {
        return res.status(400).json({ message: 'Index must be 0 or 1 if provided.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Password hashing should be handled by a pre-save hook in the User model.
    // Assign a default index of 0 if not provided during registration.
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password, // Password will be hashed by the User model's pre-save hook
      role,
      index: index !== undefined ? index : 0 // Set index, default to 0 (ON)
    });

    // Generate JWT Token, now including the user's index
    const token = generateToken(newUser._id, newUser.role, newUser.index);

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        index: newUser.index // Include index in response
      },
      token
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration: ' + error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for missing fields
    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find user with case-insensitive email and fetch the 'index' field
    const user = await User.findOne({ email: email.toLowerCase() });

    // If user not found
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare the input password with the stored hashed password using the model method
    // (e.g., user.matchPassword(password) assuming bcrypt.compare is used there)
    // If you are storing plaintext passwords, replace this with 'password !== user.password'.
    // NOTE: The provided code snippets have switched between hashed and plaintext.
    // Ensure your User model consistently uses one approach. Hashing is strongly recommended.
    const isMatch = await user.matchPassword(password); // Assuming matchPassword method exists
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT Token, now including the user's index
    const token = generateToken(user._id, user.role, user.index);

    // Send successful login response
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        index: user.index // Include index in response
      },
      token
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: error.message || 'Unexpected server error' });
  }
};

// ✅ Update Index Controller - now correctly updates 'User' by ID
exports.updateindex = async (req, res) => {
  try {
    const userId = req.params.id; // Get user ID from URL parameter (e.g., /users/:id/status)
    const { newIndexValue } = req.body; // Get new index value (0 or 1) from the request body

    // Validate newIndexValue
    if (newIndexValue === undefined || (newIndexValue !== 0 && newIndexValue !== 1)) {
      return res.status(400).json({ message: 'A valid new index value (0 or 1) is required.' });
    }

    // Find the User by ID and update their 'index' field
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { index: newIndexValue },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    // If user not found
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      message: 'User index updated successfully',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        index: updatedUser.index,
        role: updatedUser.role // Include role for consistency
      }
    });

  } catch (error) {
    console.error('Update Index Error:', error);
    res.status(500).json({ message: 'Server error during index update: ' + error.message });
  }
};
