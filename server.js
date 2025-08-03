// server.js
// Main server entry point for the multi-tenant ERP system.

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// ========================
// 🔐 Core Middleware
// ========================
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// ========================
// 📡 MongoDB Connection
// ========================
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};
connectDB();

// ========================
// 🧩 Middleware & Routes
// ========================
const { isSuperAdmin } = require('./middleware/superAdminMiddleware');
const tenantResolver = require('./middleware/tenantResolver'); // <-- 1. IMPORTED the new middleware

const provisioningRoutes = require('./routes/rovisioningRoutes');
const userRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/authroutesuser');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orders');
const siteConfigRoutes = require('./routes/site');
const emailRoutes = require('./routes/emails');

// ========================
// 🚏 Mount Routes
// ========================
app.use('/api/provision', isSuperAdmin, provisioningRoutes); // Super admin only

// <-- 2. APPLY the tenantResolver middleware before any routes that need it.
// This ensures that req.tenant is populated for every request to these paths.
app.use('/users', tenantResolver, userRoutes);
app.use('/customers', tenantResolver, customerRoutes);
app.use('/products', tenantResolver, productRoutes);
app.use('/orders', tenantResolver, orderRoutes);

// These routes may not need tenant context, so the middleware is omitted.
app.use('/config', siteConfigRoutes);
app.use('/emails', emailRoutes);

// ========================
// ❌ Error Handling
// ========================
app.use((req, res) => {
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
