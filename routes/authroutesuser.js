const express = require('express');
const { register, login, getUsers } = require('../controllers/authcontrolleruser'); // Make sure to import getUsers as well

const router = express.Router();

router.post('/registeruser', register);
router.post('/loginuser', login);
router.get('/users', getUsers); // Assuming you want this route for fetching users

module.exports = router;
