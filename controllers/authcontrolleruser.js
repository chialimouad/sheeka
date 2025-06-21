const Client = require('../models/Client');
const jwt = require('jsonwebtoken');

// ✅ Client Registration (POST /register)
exports.registerClient = async (req, res) => {
  try {
    const { name, email, phoneNumber, password } = req.body;

    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const newClient = new Client({
      name,
      email,
      phoneNumber,
      password, // ⚠️ stored as plain text
      role: 'client', // default role
    });

    await newClient.save();

    res.status(201).json({ message: 'Client registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Client Login (POST /login)
exports.loginClient = async (req, res) => {
  try {
    const { email, password } = req.body;

    const client = await Client.findOne({ email });
    if (!client || client.password !== password) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { clientId: client._id, role: client.role },
      'usersecret',
      { expiresIn: '7d' }
    );

    const clientInfo = {
      _id: client._id,
      name: client.name,
      email: client.email,
      role: client.role,
    };

    res.json({
      message: 'Login successful',
      token,
      client: clientInfo,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
