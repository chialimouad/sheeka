/**
 * FILE: ./server.js
 * DESC: Main server entry point for the multi-tenant ERP system.
 *
 * FIXES APPLIED:
 * - Configured Express to correctly serve static files from the 'uploads' directory,
 * resolving 404 errors for images.
 * - Added support for persistent storage on platforms like Render using environment variables.
 * - Configured Helmet to allow cross-origin resource loading, preventing browsers
 * from blocking images.
 * - Disabled Helmet's default Content Security Policy (CSP) which is often too
 * strict for dynamic applications loading external resources.
 * - Set up a global CORS policy to allow requests from any frontend domain.
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

// Define the primary directory for file uploads.
// This uses the path provided by Render's Persistent Disks if the environment variable is set.
// If not, it falls back to a local 'public/uploads' directory for development.
const UPLOADS_DIR = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, 'public', 'uploads');

// Serve the uploaded images publicly. 
// This is the key fix: any request starting with '/uploads' will now be served
// directly from the UPLOADS_DIR.
console.log(`✅ Serving uploaded files from: ${UPLOADS_DIR}`);
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve other static assets (like CSS, client-side JS, etc.) from the 'public' directory.
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
const siteConfigRoutes = require('./routes/site');
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
