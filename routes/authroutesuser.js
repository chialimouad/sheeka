const express = require('express');
const { register, login, getUsers, updateindex,getUserIndex } = require('../controllers/authcontrolleruser'); // Added updateindex to the import

const router = express.Router();

router.post('/registeruser', register);
router.post('/loginuser', login);
router.get('/users', getUsers); // Assuming you want this route for fetching users

router.put('/users/:id', updateindex); // FIX: Added :id to match controller expectation
router.get('/users/:id/index', getUserIndex); // New: Route to get a user's index by ID

module.exports = router;
