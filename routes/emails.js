// --- routes/emailRoutes.js ---
// API routes for emails and related operations
const express = require('express');
const {
  sendEmail,
  getSentEmails,
  getClientEmails,
  getResponses, // Added this import
  sendResponseToAllClients,
  setAdminCredentials
} = require('../controllers/emailController'); // Corrected import path from '../controllers/email'
const router = express.Router();

// Route to set or update the admin email credentials
// WARNING: This route handles sensitive data. In production, this must be highly secured.
router.post('/admin-credentials', setAdminCredentials);

// Public route for clients to send an email
router.post('/emails', sendEmail);

// Route to fetch all individual emails sent by clients
router.get('/emails', getSentEmails);

// Route to fetch all unique client email addresses
router.get('/clients', getClientEmails);

// New route to fetch all sent responses
router.get('/responses', getResponses); // Added this route

// Route for an administrator to send a collective response to clients
// This route should also be protected with authentication/authorization in production.
router.post('/emails/send-response', sendResponseToAllClients);

module.exports = router;