// models/Email.js
const mongoose = require('mongoose');

// Define the Email Schema
const EmailSchema = new mongoose.Schema({
    // Sender's name, required and trimmed
    senderName: {
        type: String,
        required: [true, 'Sender name is required'], // Enforce sender name
        trim: true // Remove whitespace from both ends of a string
    },
    // Sender's email, required, must match email format, and trimmed
    senderEmail: {
        type: String,
        required: [true, 'Sender email is required'], // Enforce sender email
        match: [/.+@.+\..+/, 'Please use a valid email address'], // Basic regex for email validation
        trim: true
    },
    // Recipient's email, required, must match email format, and trimmed
    recipientEmail: {
        type: String,
        required: [true, 'Recipient email is required'], // Enforce recipient email
        match: [/.+@.+\..+/, 'Please use a valid email address'],
        trim: true
    },
    // Email subject, required and trimmed
    subject: {
        type: String,
        required: [true, 'Subject is required'], // Enforce subject
        trim: true
    },
    // Email message body, required and trimmed
    message: {
        type: String,
        required: [true, 'Message is required'], // Enforce message content
        trim: true
    },
    // Timestamp when the email was sent/saved, defaults to current time
    sentAt: {
        type: Date,
        default: Date.now // Automatically sets the current date/time on creation
    }
});

// Export the Email model based on the schema
module.exports = mongoose.model('Email', EmailSchema);
