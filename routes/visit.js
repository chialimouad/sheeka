// visitorRoutes.js
const express = require('express');
const router = express.Router(); // Create a new router object
const visitorController = require('../controllers/visitcontroller'); // Import the controller

// Define the API endpoint to get the real-time count of visitors.
// This route will be mounted under the path specified in server.js (e.g., '/')
router.get('/realtime', visitorController.getRealtimeVisitors);

module.exports = router;
