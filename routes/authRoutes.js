const express = require('express');
const router = express.Router();
const { register, login ,getUsers,updateindex,getUserIndex} = require('../controllers/authController');

// Define routes
router.post('/register', register);
router.post('/login', login);
router.get('/users', getUsers);  // ✅ Add this line to fetch users
router.put('/ausers/:id', updateindex); // FIX: Added :id to match controller expectation
router.get('/ausers/:id/index', getUserIndex); // New: Route to get a user's index by ID

module.exports = router;
