// controllers/emailController.js
const Email = require('../models/emails'); // Import the Email Mongoose model
const nodemailer = require('nodemailer'); // Import nodemailer

// Declare mutable variables for email credentials and transporter
// These will be configured via the /configure-sender endpoint.
let currentEmailUser = null;
let currentEmailPass = null;
let transporter = null; // Initialize transporter as null

// Function to initialize or re-initialize the Nodemailer transporter
// This will be called when credentials are set or updated.
const initializeTransporter = () => {
    if (currentEmailUser && currentEmailPass) {
        transporter = nodemailer.createTransport({
            service: 'gmail', // Example: 'gmail'. Use your email service.
            auth: {
                user: currentEmailUser,
                pass: currentEmailPass
            },
            // Optional: For self-signed certificates or development, you might need this.
            // In production, ensure proper SSL/TLS.
            tls: {
                rejectUnauthorized: false
            }
        });
        console.log('Nodemailer transporter re-initialized with new credentials.');
    } else {
        transporter = null; // Clear transporter if credentials are removed or incomplete
        console.warn('Nodemailer transporter not initialized. Email user/pass are missing.');
    }
};

// @desc    Configure/Update the email sender credentials
// @route   PUT /api/emails/configure-sender
// @access  Public (should be protected in production)
exports.configureSender = (req, res) => {
    const { emailUser, emailPass } = req.body;

    if (!emailUser || !emailPass) {
        return res.status(400).json({ msg: 'Please provide both emailUser and emailPass.' });
    }

    currentEmailUser = emailUser;
    currentEmailPass = emailPass;
    initializeTransporter(); // Re-initialize the transporter with new credentials

    res.status(200).json({ msg: 'Email sender credentials updated successfully.', configuredUser: currentEmailUser });
};


// @desc    Send an email and save its details to the database
// @route   POST /api/emails/send
// @access  Public
exports.sendEmail = async (req, res) => {
    // Destructure required fields from the request body
    const { senderName, senderEmail, recipientEmail, subject, message } = req.body;

    // Basic server-side validation to ensure all necessary fields are provided
    if (!senderName || !senderEmail || !recipientEmail || !subject || !message) {
        return res.status(400).json({ msg: 'Please provide all required fields: senderName, senderEmail, recipientEmail, subject, and message.' });
    }

    // Check if transporter is initialized (i.e., credentials have been set)
    if (!transporter) {
        return res.status(400).json({ msg: 'Email sender not configured. Please configure emailUser and emailPass first via /api/emails/configure-sender.' });
    }

    try {
        // Step 1: Create a new Email document based on the Mongoose model
        const newEmail = new Email({
            senderName,
            senderEmail,
            recipientEmail, // Store recipient email in the database
            subject,
            message
        });

        // Step 2: Save the new email document to MongoDB
        const savedEmail = await newEmail.save();

        // Step 3: Send the actual email using the configured transporter
        const mailOptions = {
            from: currentEmailUser, // Sender address (currently configured email)
            to: recipientEmail,          // List of recipients from request
            subject: subject,            // Subject line from request
            text: `From: ${senderName} <${senderEmail}>\n\n${message}`, // Plain text body
            html: `
                <p><strong>From:</strong> ${senderName} &lt;${senderEmail}&gt;</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p>${message}</p>
            ` // HTML body
        };

        let info;
        try {
            info = await transporter.sendMail(mailOptions);
            console.log("Message sent: %s", info.messageId);
            // Optionally, for Ethereal testing, uncomment:
            // console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
        } catch (emailSendError) {
            console.error("Error sending email via Nodemailer:", emailSendError);
            // If email sending failed but saving to DB succeeded, inform the user
            return res.status(200).json({
                msg: 'Email saved to database, but there was an issue sending the actual email.',
                email: savedEmail,
                emailServiceResponse: { success: false, error: emailSendError.message }
            });
        }
        
        // If both saving and sending were successful
        res.status(201).json({
            msg: 'Email sent and saved successfully.',
            email: savedEmail,
            emailServiceResponse: { success: true, messageId: info.messageId }
        });

    } catch (err) {
        // More specific error handling for Mongoose validation errors
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        // General server error for other issues
        console.error('Error in sendEmail controller (saving or other):', err.message);
        res.status(500).json({ msg: 'Server Error: Could not process email request.', error: err.message });
    }
};

// @desc    Retrieve all emails stored in the database
// @route   GET /api/emails
// @access  Public
exports.getEmails = async (req, res) => {
    try {
        // Find all emails and sort them by the 'sentAt' field in descending order (newest first)
        const emails = await Email.find().sort({ sentAt: -1 });
        res.json(emails); // Send the retrieved emails as a JSON response
    } catch (err) {
        // Handle any errors during database retrieval
        console.error('Error in getEmails controller:', err.message);
        res.status(500).json({ msg: 'Server Error: Could not retrieve emails.', error: err.message });
    }
};

// @desc    Retrieve a single email by its ID
// @route   GET /api/emails/:id
// @access  Public
exports.getEmailById = async (req, res) => {
    try {
        // Find an email by its ID from the request parameters
        const email = await Email.findById(req.params.id);

        // If no email is found with the given ID, return a 404 Not Found error
        if (!email) {
            return res.status(404).json({ msg: 'Email not found.' });
        }

        res.json(email); // Send the found email as a JSON response
    } catch (err) {
        // Handle errors, including invalid MongoDB ObjectId format
        console.error('Error in getEmailById controller:', err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ msg: 'Invalid email ID format.' });
        }
        res.status(500).json({ msg: 'Server Error: Could not retrieve email.', error: err.message });
    }
};
