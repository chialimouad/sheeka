/**
 * FILE: ./server.js
 * DESC: Main server entry point for the multi-tenant ERP system.
 *
 * FIX:
 * - Corrected the import path for site configuration routes from './routes/site'
 * to './routes/siteConfigRoutes'. This resolves a server startup crash caused
 * by an incorrect import in the old file, which was making all endpoints,
 * including '/users', return a 404 error.
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

// ========================
// 🔐 Core Middleware
// ========================

// Allow Cross-Origin Resource Sharing from any domain
app.use(cors({ origin: '*' })); 

// Parse incoming JSON request bodies
app.use(express.json());

// Configure Helmet for security headers
app.use(helmet({
    // Allow images and other resources to be loaded from this server on different domains
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Disable the default Content Security Policy, which can be too restrictive
    // and block images or scripts. A custom, more specific CSP could be added later if needed.
    contentSecurityPolicy: false, 
}));

// Log HTTP requests in development mode
app.use(morgan('dev'));

// ========================
// 📁 Static File Serving
// ========================

const UPLOADS_DIR = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, 'public', 'uploads');

console.log(`✅ Serving uploaded files from: ${UPLOADS_DIR}`);
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));


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
        process.exit(1); // Exit process with failure
    }
};
connectDB();

// ========================
// 🧩 Middleware & Routes
// ========================
const { isSuperAdmin } = require('./middleware/superAdminMiddleware');
const { identifyTenant } = require('./middleware/authMiddleware'); 

// Import route handlers
const provisioningRoutes = require('./routes/rovisioningRoutes');
const userRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/authroutesuser'); 
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orders');
// FIX: Corrected the import path to the proper routes file.
const siteConfigRoutes = require('./routes/siteConfigRoutes'); 
const emailRoutes = require('./routes/emails');


// ========================
// 🚏 Mount Routes
// ========================
// Apply the correct middleware to each route group
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

// Catch-all for 404 Not Found errors
app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

// Global error handler
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
