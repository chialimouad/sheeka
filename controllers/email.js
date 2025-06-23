

// --- controllers/emailController.js ---
// Logic for handling email-related operations
const Email = require('../models/emails');
const ClientEmail = require('../models/clientemail');
const Response = require('../models/emailres');
const AdminCredential = require('../models/admin');
const nodemailer = require('nodemailer');

// Global transporter instance, will be initialized/updated dynamically
let transporter;

// Helper function to create or update the Nodemailer transporter
const createTransporter = (email, password) => {
  transporter = nodemailer.createTransport({
    service: 'gmail', // You can configure this for other services or SMTP
    auth: {
      user: email,
      pass: password
    }
  });
  console.log('Nodemailer transporter initialized/updated.');
};

/**
 * @desc    Set/Update admin email credentials.
 * WARNING: Storing credentials directly is highly insecure.
 * This route is for demonstrating dynamic credential setting per user's request.
 * @route   POST /api/admin-credentials
 * @access  Private (should be protected with proper authentication/authorization in production)
 */
exports.setAdminCredentials = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required to set admin credentials.' });
  }

  try {
    // Find if credentials already exist; if so, update them, otherwise create new
    let adminCred = await AdminCredential.findOne();
    if (adminCred) {
      adminCred.email = email;
      adminCred.password = password; // WARNING: Storing passwords directly is insecure
      await adminCred.save();
      console.log('Admin credentials updated.');
    } else {
      adminCred = new AdminCredential({ email, password }); // WARNING: Storing passwords directly is insecure
      await adminCred.save();
      console.log('Admin credentials set.');
    }
    // Initialize the transporter immediately after setting credentials
    createTransporter(email, password);
    res.status(200).json({ message: 'Admin email credentials set successfully. WARNING: Direct storage is insecure.', credentials: { email: adminCred.email } });
  } catch (error) {
    console.error('Error setting admin credentials:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Send an email from a client and save it to the database.
 * Also adds the client's email to the ClientEmail collection if it's new.
 * @route   POST /api/emails
 * @access  Public
 */
exports.sendEmail = async (req, res) => {
  const { senderEmail, senderName, message } = req.body;

  // Basic validation
  if (!senderEmail || !senderName || !message) {
    return res.status(400).json({ message: 'Please enter all fields: senderEmail, senderName, message.' });
  }

  try {
    // 1. Save the email message to the 'emails' collection
    const newEmail = new Email({
      senderEmail,
      senderName,
      message
    });
    await newEmail.save();

    // 2. Add the sender's email to the 'clientemails' collection if it doesn't already exist
    let client = await ClientEmail.findOne({ emailAddress: senderEmail });
    if (!client) {
      client = new ClientEmail({ emailAddress: senderEmail });
      await client.save();
      console.log(`New unique client email added: ${senderEmail}`);
    }

    res.status(201).json({ message: 'Email sent and saved successfully!', email: newEmail });
  } catch (error) {
    console.error('Error sending or saving email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Fetch all sent emails from the 'emails' collection.
 * @route   GET /api/emails
 * @access  Public (consider adding authentication for production)
 */
exports.getSentEmails = async (req, res) => {
  try {
    // Fetch all emails, sorted by creation date descending
    const emails = await Email.find().sort({ createdAt: -1 });
    res.status(200).json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Fetch all unique client emails from the 'clientemails' collection.
 * @route   GET /api/clients
 * @access  Private (should be protected with proper authentication/authorization)
 */
exports.getClientEmails = async (req, res) => {
  try {
    const clientEmails = await ClientEmail.find().sort({ createdAt: -1 });
    res.status(200).json(clientEmails);
  } catch (error) {
    console.error('Error fetching client emails:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Send a response email to all clients who have sent an email
 * and have not yet received a response.
 * @route   POST /api/emails/send-response
 * @access  Private (requires admin authentication/authorization and Admin Credentials set)
 */
exports.sendResponseToAllClients = async (req, res) => {
  const { responseSubject, responseMessage } = req.body;

  if (!responseSubject || !responseMessage) {
    return res.status(400).json({ message: 'Please provide a responseSubject and responseMessage.' });
  }

  // Retrieve admin email credentials from the database
  const adminCred = await AdminCredential.findOne();
  if (!adminCred) {
    return res.status(400).json({ message: 'Admin email credentials are not set. Please set them first via /api/admin-credentials.' });
  }

  // Initialize the transporter with the retrieved admin credentials
  createTransporter(adminCred.email, adminCred.password);
  if (!transporter) {
    return res.status(500).json({ message: 'Email transporter could not be initialized. Check admin credentials and Nodemailer configuration.' });
  }

  try {
    // Find all emails that have been sent by clients
    const allClientEmails = await Email.find({});

    // Find all email IDs that have already received a response
    const respondedEmailIds = (await Response.find({}, { emailId: 1, _id: 0 }))
      .map(r => r.emailId.toString()); // Convert ObjectId to string for comparison

    // Filter out emails that have already received a response
    const emailsToRespond = allClientEmails.filter(emailDoc =>
      !respondedEmailIds.includes(emailDoc._id.toString())
    );

    if (emailsToRespond.length === 0) {
      return res.status(200).json({ message: 'No new emails found that require a response.' });
    }

    let successCount = 0;
    let failedEmails = [];

    for (const emailDoc of emailsToRespond) {
      const mailOptions = {
        from: adminCred.email, // Use the admin's email for sending
        to: emailDoc.senderEmail,     // Recipient's email (original sender)
        subject: responseSubject,
        text: `Dear ${emailDoc.senderName},\n\n${responseMessage}\n\nBest regards,\nYour Team`
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Response sent to: ${emailDoc.senderEmail} (Original Email ID: ${emailDoc._id})`);

        // Create a new entry in the 'responses' collection for this sent response
        const newResponse = new Response({
          emailId: emailDoc._id,
          subject: responseSubject,
          message: responseMessage
        });
        await newResponse.save();
        successCount++;
      } catch (mailError) {
        console.error(`Failed to send response to ${emailDoc.senderEmail} (Original Email ID: ${emailDoc._id}):`, mailError);
        failedEmails.push(emailDoc.senderEmail);
      }
    }

    res.status(200).json({
      message: `Attempted to send responses to ${emailsToRespond.length} emails.`,
      successfulSends: successCount,
      failedSends: failedEmails.length,
      failedEmails: failedEmails
    });

  } catch (error) {
    console.error('Error in sendResponseToAllClients:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
