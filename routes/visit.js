// visitorRoutes.js
const express = require('express');
const router = express.Router(); // Create a new router object
const visitorController = require('../controllers/visitcontroller'); // Import the controller

// Define the API endpoint to get various visitor statistics.
// This route will now return real-time, daily, monthly, and total visitor counts.
router.get('/stats', visitorController.getVisitorStats); // Changed endpoint to /stats and function name

module.exports = router;
