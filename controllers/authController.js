const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

// ✅ Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
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

    // Hash password before saving using crypto
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    // Create new user
    const newUser = await User.create({ name, email: email.toLowerCase(), password: hashedPassword, role });

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

// ✅ Login Controller
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Log the received request data for debugging
    console.log("Received Login Request:", email, password);

    // Check for missing fields
    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find user with case-insensitive email
    const user = await User.findOne({ email: email.toLowerCase() });

    // If user not found
    if (!user) {
      console.error("User not found in database");
      return res.status(401).json({ message: 'Invalid credentials 1' });
    }

    // Hash the input password and compare it with the stored password
    const hashedInputPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    if (hashedInputPassword !== user.password) {
      console.error("Password mismatch for user:", email);
      return res.status(401).json({ message: 'Invalid credentials2' });
    }

    // Generate JWT Token
    const token = generateToken(user._id, user.role);

    // Send successful login response
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
    res.status(500).json({ message: 'Server error' });
  }
};
