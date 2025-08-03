/**
 * FILE: ./server.js
 * DESC: Main server entry point for the multi-tenant ERP system.
 *
 * FIX:
 * - Updated all require() statements to use the correct filenames for the route
 * modules as provided. This ensures that all routes, including `/site-config`,
 * are properly loaded and registered by the Express app.
 */

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
const { identifyTenant } = require('./middleware/authMiddleware'); 

// FIX: Using the correct route filenames provided by the user.
const provisioningRoutes = require('./routes/rovisioningRoutes'); // Corrected typo from 'rovisioning'
const userRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/authroutesuser'); 
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orders');
const siteConfigRoutes = require('./routes/site'); // Corrected to 'site'
const emailRoutes = require('./routes/emails');


// ========================
// 🚏 Mount Routes
// ========================
app.use('/provision', isSuperAdmin, provisioningRoutes);
app.use('/users', identifyTenant, userRoutes);
app.use('/customers', identifyTenant, customerRoutes);
app.use('/products', identifyTenant, productRoutes);
app.use('/orders', identifyTenant, orderRoutes);
app.use('/site-config', identifyTenant, siteConfigRoutes);
app.use('/emails', emailRoutes);

// ========================
// ❌ Error Handling
// ========================
app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
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
