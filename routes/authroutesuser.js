const express = require('express');
const { register, login, getUsers, updateindex } = require('../controllers/authcontrolleruser'); // Added updateindex to the import

const router = express.Router();

router.post('/registeruser', register);
router.post('/loginuser', login);
router.get('/users', getUsers); // Assuming you want this route for fetching users

router.put('/users/:id', updateindex); // FIX: Added :id to match controller expectation

module.exports = router;
