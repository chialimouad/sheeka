const express = require('express');
const router = express.Router();
const { register, login ,getUsers,updateindex} = require('../controllers/authController');

// Define routes
router.post('/register', register);
router.post('/login', login);
router.get('/users', getUsers);  // ✅ Add this line to fetch users
router.put('/ausers/:id/status', updateindex); // This route now correctly references the imported updateindex function

module.exports = router;
