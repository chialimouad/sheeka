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

    // Generate salt
    const salt = crypto.randomBytes(16).toString('hex'); // 16-byte salt
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password + salt)  // Concatenate salt with password
      .digest('hex');

    // Create new user with the salt included in the data
    const newUser = await User.create({ 
      name, 
      email: email.toLowerCase(), 
      password: hashedPassword, 
      role,
      salt  // Store the salt in the user record
    });

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

    // Rehash the input password with the stored salt and compare
    const hashedInputPassword = crypto
      .createHash('sha256')
      .update(password + user.salt)  // Use the stored salt here
      .digest('hex');

    if (hashedInputPassword !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
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

