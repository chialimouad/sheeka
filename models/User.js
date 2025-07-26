const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// --- Department Schema ---
const DepartmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Department name is required'],
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    }
}, { timestamps: true });

const Department = mongoose.model('Department', DepartmentSchema);


// --- Document Schema (for User) ---
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


// --- Main User Schema (replaces Employee) ---
const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    select: false // Hide password by default
  },
  jobTitle: {
    type: String,
    trim: true,
    default: 'Not Assigned'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: false // Make it optional for flexibility
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Self-referencing to another User
    default: null
  },
  employmentStatus: {
    type: String,
    enum: ['active', 'on_leave', 'resigned', 'terminated'],
    default: 'active'
  },
  contractType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contractor', 'Intern', 'Not Applicable'],
    default: 'Not Applicable'
  },
  role: { 
    type: String, 
    enum: ['admin', 'confirmation', 'stockagent', 'employee'],
    default: 'employee'
  },
  documents: [DocumentSchema],
  hireDate: {
    type: Date,
    default: Date.now
  },
}, { timestamps: true });

// Password Hashing Middleware
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password Comparison Method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

// Export the necessary models
module.exports = { User, Department };
