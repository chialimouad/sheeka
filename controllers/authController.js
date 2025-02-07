// controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hashedPassword, role });

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

    console.log("Received Login Request:", email, password); // Debugging Log

    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await User.findOne({ email });
    console.log("User Found in Database:", user); // Debugging Log

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password Match:", isMatch); // Debugging Log

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

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
    res.status(500).json({ message: 'Server error' });
  }
};

