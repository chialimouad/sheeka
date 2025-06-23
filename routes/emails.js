// routes/emailRoutes.js
const express = require('express');
const router = express.Router(); // Create a new Express router
const emailController = require('../controllers/email'); // Import the email controller

// POST /api/emails/send
// This route handles sending a new email.
// It will use the 'sendEmail' function from the emailController.
router.post('/send', emailController.sendEmail);

// GET /api/emails
// This route retrieves all emails stored in the database.
// It will use the 'getEmails' function from the emailController.
router.get('/', emailController.getEmails);

// GET /api/emails/:id
// This route retrieves a single email by its unique ID.
// It will use the 'getEmailById' function from the emailController.
router.get('/:id', emailController.getEmailById);

// PUT /api/emails/configure-sender
// This new route handles configuring/updating the email sender's username and password.
// It will use the 'configureSender' function from the emailController.
// IMPORTANT: In a production environment, this route should be protected by authentication
// and authorization to prevent unauthorized access.
router.put('/configure-sender', emailController.configureSender);


// Export the router to be used in the main application file (e.g., server.js)
module.exports = router;
