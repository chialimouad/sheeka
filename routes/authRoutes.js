const express = require('express');
const router = express.Router();
const { register, login ,getUsers,updateindex} = require('../controllers/authController');

// Define routes
router.post('/register', register);
router.post('/login', login);
router.get('/users', getUsers);  // ✅ Add this line to fetch users
router.put('/ausers/:id', updateindex); // FIX: Added :id to match controller expectation

module.exports = router;
