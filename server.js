// server.js
// Main server entry point for the multi-tenant ERP system.

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// --- Import Middleware ---
const { isSuperAdmin } = require('./middleware/superAdminMiddleware');

const app = express();

// ========================
// 📦 Core Middleware
// ========================
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// ========================
// 📡 Connect to MongoDB
// ========================
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};
connectDB();

// ========================
// 🧩 Import Route Modules
// ========================
const provisioningRoutes = require('./routes/rovisioningRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const siteConfigRoutes = require('./routes/siteConfigRoutes');
const emailRoutes = require('./routes/emailRoutes');

// ========================
// 🚏 Mount Routes
// ========================

// --- Super Admin Routes ---
// These routes are for the master admin to create and manage clients.
// They are protected by a master API key.
app.use('/api/provision', isSuperAdmin, provisioningRoutes);

// --- Tenant-Specific API Routes ---
// These are the main application routes. The `identifyTenant` middleware
// will run on each of these to determine which client's data to access.
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/config', siteConfigRoutes);
app.use('/api/emails', emailRoutes);


// ========================
// ❌ Error Handling
// ========================
app.use((req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack);
    res.status(err.statusCode || 500).json({
        message: err.message || 'Internal Server Error',
    });
});

// ========================
// 🚀 Start Server
// ========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
