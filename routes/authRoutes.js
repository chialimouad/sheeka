const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// Define routes
router.post('/register', register);
router.post('/login', login);
router.get('/users', getUsers);  // ✅ Add this line to fetch users

module.exports = router;
