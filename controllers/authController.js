const User = require('../models/User');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

// ✅ Generate JWT Token
const generateToken = (id, role) => {
  // It's highly recommended to use an environment variable for your JWT secret
  // process.env.JWT_SECRET should be set in your .env file
  return jwt.sign({ id, role }, process.env.JWT_SECRET || "mouadsecret_fallback", { expiresIn: '28d' });
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'name email role'); // Fetch only necessary fields
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Register Controller
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Password hashing is handled by the pre-save hook in the User model.
    // Ensure your User model has a pre-save hook to hash the password before saving.
    const newUser = await User.create({ name, email: email.toLowerCase(), password, role });

    // Generate JWT Token
    const token = generateToken(newUser._id, newUser.role);

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      token
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for missing fields
    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find user with case-insensitive email
    const user = await User.findOne({ email: email.toLowerCase() });

    // If user not found
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare the input password with the stored hashed password using the model method.
    // Ensure your User model has a method like 'matchPassword' that uses bcrypt.compare().
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT Token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Login Error:', error);
    // Send back the actual error message
    res.status(500).json({ message: error.message || 'Unexpected server error' });
  }
};
