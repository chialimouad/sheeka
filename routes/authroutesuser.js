const express = require('express');
const { register, login, getUsers, updateindex } = require('../controllers/authcontrolleruser'); // Added updateindex to the import

const router = express.Router();

router.post('/registeruser', register);
router.post('/loginuser', login);
router.get('/users', getUsers); // Assuming you want this route for fetching users

router.put('/users/:id/status', updateindex); // This route now correctly references the imported updateindex function

module.exports = router;
