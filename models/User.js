const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

// -----------------------------
// 1. Admin & Core Schemas
// -----------------------------

/**
 * @description Admin credentials for logging into the system's backend/admin panel.
 */
const adminCredentialSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  password: {
    type: String,
    required: true
  },
  index: {
    type: Number,
    enum: [0, 1],
    default: 0
  }
}, { timestamps: true });

/**
 * @description A generic user model with roles for different system access levels.
 * Includes password hashing and comparison methods.
 */
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'confirmation', 'stockagent'],
    default: 'confirmation'
  },
  index: {
    type: Number,
    enum: [0, 1],
    default: 0
  },
  orders: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    }
  ]
});

// --- Mongoose Middleware (Pre-save Hook) ---
// Hashes the user's password automatically before saving it to the database.
UserSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// --- Mongoose Instance Method ---
// Compares a candidate password with the user's hashed password.
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};


/**
 * @description Represents a department within the company.
 */
const departmentSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    }
}, { timestamps: true });


// -----------------------------
// 2. Employee Management Schemas
// -----------------------------

/**
 * @description The core model for an employee. This is central to the entire system.
 */
const employeeSchema = new Schema({
    // Basic Information
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
    },
    jobTitle: { type: String, required: true },
    hireDate: { type: Date, required: true },

    // Employment Status
    employmentStatus: {
        type: String,
        required: true,
        enum: ['Active', 'On Leave', 'Terminated'],
        default: 'Active'
    },

    // Relationships to other models
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    manager: { type: Schema.Types.ObjectId, ref: 'Employee', default: null }, // Self-reference for manager

    // Documents (e.g., ID, contract, diplomas)
    documents: [{
        name: { type: String, required: true },
        url: { type: String, required: true } // URL to the stored document (e.g., in S3, Cloudinary)
    }]
}, { timestamps: true });


// -----------------------------
// 3. Attendance & Leave Schemas
// -----------------------------

/**
 * @description Tracks daily check-in and check-out for an employee.
 */
const attendanceSchema = new Schema({
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Late'],
        required: true
    }
}, { timestamps: true });

/**
 * @description Manages leave requests from employees.
 */
const leaveSchema = new Schema({
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: {
        type: String,
        required: true,
        enum: ['Vacation', 'Sick Leave', 'Personal', 'Unpaid']
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Employee', default: null } // Manager who approved
}, { timestamps: true });


// -----------------------------
// 4. Payroll Schemas
// -----------------------------

/**
 * @description Defines the salary structure for a contract.
 */
const salaryStructureSchema = new Schema({
    basic: { type: Number, required: true, default: 0 },
    bonuses: [{
        name: String,
        amount: Number
    }],
    deductions: [{
        name: String,
        amount: Number
    }]
});

/**
 * @description Represents a generated payslip for an employee for a specific period.
 */
const payslipSchema = new Schema({
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    payPeriodStart: { type: Date, required: true },
    payPeriodEnd: { type: Date, required: true },
    salaryDetails: {
        basic: Number,
        bonuses: Number, // Sum of all bonuses
        deductions: Number, // Sum of all deductions
        netSalary: Number
    },
    status: {
        type: String,
        enum: ['Generated', 'Locked', 'Paid'],
        default: 'Generated'
    }
}, { timestamps: true });


// -----------------------------
// 5. Recruitment Schemas
// -----------------------------

/**
 * @description A job opening posted by the company.
 */
const jobOpeningSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    status: {
        type: String,
        enum: ['Open', 'Closed', 'On Hold'],
        default: 'Open'
    }
}, { timestamps: true });

/**
 * @description Tracks an applicant for a specific job opening.
 */
const applicantSchema = new Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    jobOpening: { type: Schema.Types.ObjectId, ref: 'JobOpening', required: true },
    status: {
        type: String,
        enum: ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'],
        default: 'Applied'
    },
    documents: {
        cvUrl: String,
        coverLetterUrl: String
    },
    interviewNotes: [{
        interviewer: String,
        rating: { type: Number, min: 1, max: 5 },
        notes: String,
        date: { type: Date, default: Date.now }
    }]
}, { timestamps: true });


// -----------------------------
// 6. Additional Schemas
// -----------------------------

/**
 * @description Handles requests for employment verification (Status Confirmation Service).
 */
const employmentVerificationSchema = new Schema({
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true }, // The employee being verified
    requestingParty: { type: String, required: true, trim: true }, // e.g., "Bank of America"
    requestDate: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Rejected'],
        default: 'Pending'
    },
    processedBy: { type: Schema.Types.ObjectId, ref: 'Employee', default: null }, // The employee who handled the request
    completedDate: { type: Date },
    // Optional: Store a snapshot of the confirmed data at the time of request
    confirmedDetails: {
        jobTitle: String,
        employmentStatus: String,
        hireDate: Date
    }
}, { timestamps: true });

/**
 * @description Manages stock grants/options for employees (Stock Agent feature).
 */
const stockGrantSchema = new Schema({
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true }, // The employee receiving the grant
    administeredBy: { type: Schema.Types.ObjectId, ref: 'Employee', required: true }, // The stock agent/admin managing the grant
    grantDate: { type: Date, required: true },
    quantity: { type: Number, required: true },
    grantType: {
        type: String,
        enum: ['ISO', 'NSO', 'RSU'], // Incentive Stock Option, Non-qualified Stock Option, Restricted Stock Unit
        required: true
    },
    vestingSchedule: [{
        vestingDate: { type: Date, required: true },
        quantityVested: { type: Number, required: true }
    }],
    cliffDate: { type: Date } // A date before which no options can be vested
}, { timestamps: true });

// -----------------------------
// 7. Miscellaneous Schemas
// -----------------------------

/**
 * @description A basic order schema to satisfy the reference in UserSchema.
 */
const OrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now }
});


// -----------------------------
// Export all models
// -----------------------------

module.exports = {
    AdminCredential: mongoose.model('AdminCredential', adminCredentialSchema),
    User: mongoose.model('User', UserSchema),
    Order: mongoose.model('Order', OrderSchema),
    Department: mongoose.model('Department', departmentSchema),
    Employee: mongoose.model('Employee', employeeSchema),
    Attendance: mongoose.model('Attendance', attendanceSchema),
    Leave: mongoose.model('Leave', leaveSchema),
    SalaryStructure: mongoose.model('SalaryStructure', salaryStructureSchema),
    Payslip: mongoose.model('Payslip', payslipSchema),
    JobOpening: mongoose.model('JobOpening', jobOpeningSchema),
    Applicant: mongoose.model('Applicant', applicantSchema),
    EmploymentVerification: mongoose.model('EmploymentVerification', employmentVerificationSchema),
    StockGrant: mongoose.model('StockGrant', stockGrantSchema)
};
