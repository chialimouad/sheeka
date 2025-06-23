const express = require('express');
const { register, login, getUsers } = require('../controllers/authcontrolleruser'); // Make sure to import getUsers as well

const router = express.Router();

router.post('/registeruser', register);
router.post('/loginuser', login);
router.get('/users', getUsers); // Assming you want this route for fetching user

module.exports = router;
