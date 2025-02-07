const express = require('express');
const { registerClient, loginClient } = require('../controllers/authcontrolleruser');

const router = express.Router();

router.post('/registeruser', registerClient);
router.post('/loginuser', loginClient);

module.exports = router;
