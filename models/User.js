const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * @typedef {object} Document
 * @property {string} documentName - The name of the document (e.g., "ID Card", "Employment Contract").
 * @property {string} documentUrl - The URL or path where the document is stored.
 * @property {Date} uploadDate - The date the document was uploaded.
 */

const DocumentSchema = new mongoose.Schema({
  documentName: { 
    type: String, 
    required: true 
  },
  documentUrl: { 
    type: String, 
    required: true 
  },
  uploadDate: { 
    type: Date, 
    default: Date.now 
  }
});


const UserSchema = new mongoose.Schema({
  // --- Basic Information ---
  name: { 
    type: String, 
    required: [true, 'Name is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    // Basic email format validation
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    select: false // Prevents password from being returned in queries by default
  },

  // --- Employment Details (New Features) ---
  jobTitle: {
    type: String,
    trim: true,
    default: 'Not Assigned'
  },
  department: {
    type: String,
    trim: true,
    default: 'Not Assigned'
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Self-referencing relationship to another user
    default: null
  },
  employmentStatus: {
    type: String,
    enum: ['active', 'on_leave', 'resigned', 'terminated'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  contractType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contractor', 'Intern', 'Not Applicable'],
    default: 'Not Applicable'
  },

  // --- System & App-Specific Fields ---
  role: { 
    type: String, 
    enum: ['admin', 'confirmation', 'stockagent', 'employee'], // Added 'employee' as a general role
    default: 'employee'
  },
  index: {
    type: Number,
    enum: [0, 1], // Ensures the 'index' field can only be 0 or 1
    default: 0   // Sets a default value of 0, aligning with "0 for on server"
  },

  // --- Linked Data ---
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  documents: [DocumentSchema] // Array for storing employee documents

}, {
  // Adds createdAt and updatedAt timestamps automatically
  timestamps: true 
});

// --- PASSWORD HASHING MIDDLEWARE ---
// Using a pre-save hook to hash the password before it's saved to the database.
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// --- PASSWORD COMPARISON METHOD ---
// Instance method to compare a candidate password with the stored hashed password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  // this.password will be available here despite `select: false` because we are in a method of the document
  return await bcrypt.compare(candidatePassword, this.password);
};


module.exports = mongoose.model('User', UserSchema);
