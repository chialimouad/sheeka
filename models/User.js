const mongoose = require('mongoose');

// --- Document Schema (for Employee) ---
const DocumentSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  url: { 
    type: String, 
    required: true 
  },
  uploadDate: { 
    type: Date, 
    default: Date.now 
  }
});

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


// --- Employee Schema ---
const EmployeeSchema = new mongoose.Schema({
  firstName: { 
    type: String, 
    required: [true, 'First name is required'] 
  },
  lastName: { 
    type: String, 
    required: [true, 'Last name is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
  },
  jobTitle: {
    type: String,
    trim: true,
    default: 'Not Assigned'
  },
  hireDate: {
    type: Date,
    default: Date.now
  },
  employmentStatus: {
    type: String,
    enum: ['active', 'on_leave', 'resigned', 'terminated'],
    default: 'active'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee', // Self-referencing to another Employee
    default: null
  },
  documents: [DocumentSchema]

}, { timestamps: true });

const Employee = mongoose.model('Employee', EmployeeSchema);


// --- EmploymentVerification Schema ---
const EmploymentVerificationSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    requestingOrganization: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processed', 'denied'],
        default: 'pending'
    },
    processedBy: { // The employee who handled the request
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    processedDate: {
        type: Date
    }
}, { timestamps: true });

const EmploymentVerification = mongoose.model('EmploymentVerification', EmploymentVerificationSchema);

// --- StockGrant Schema ---
const StockGrantSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    grantDate: {
        type: Date,
        default: Date.now
    },
    vestingSchedule: {
        type: String,
        default: 'Standard 4-year with 1-year cliff'
    },
    numberOfShares: {
        type: Number,
        required: true
    },
    administeredBy: { // The employee who administers the grant
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    }
}, { timestamps: true });

const StockGrant = mongoose.model('StockGrant', StockGrantSchema);


// Export all models
module.exports = {
    Employee,
    Department,
    EmploymentVerification,
    StockGrant
};
