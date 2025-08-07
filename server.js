/**
 * FILE: ./server.js
 * DESC: Main server entry point for the multi-tenant ERP system.
 *
 * FIX:
 * - Configured the `helmet` middleware to set the `Cross-Origin-Resource-Policy`
 * header to "cross-origin". This is necessary because Helmet's default
 * security policy can block images from being loaded on different domains,
 * even when CORS is enabled. This specifically resolves the
 * `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` error for static image assets.
 * - Configured the `cors` middleware with `cors({ origin: '*' })` to explicitly
 * allow cross-origin requests from any domain.
 * - Added logic to support persistent file storage using Render Disks.
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
app.use(cors({ origin: '*' })); 
app.use(express.json());
// FIX: Configure Helmet to allow cross-origin resource loading for images
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan('dev'));

// ========================
// 📁 Static File Serving
// ========================

// Define the path for uploaded files. Use Render Disk path if available,
// otherwise fall back to a local directory for development.
const UPLOADS_DIR = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, 'public', 'uploads');

// Serve uploaded images from the persistent disk or local fallback.
// A request to /uploads/image.png will be served from UPLOADS_DIR/image.png
console.log(`✅ Serving uploaded files from: ${UPLOADS_DIR}`);
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve other static assets from the public directory (like CSS, client-side JS)
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
        process.exit(1);
    }
};
connectDB();

// ========================
// 🧩 Middleware & Routes
// ========================
const { isSuperAdmin } = require('./middleware/superAdminMiddleware');
const { identifyTenant } = require('./middleware/authMiddleware'); 

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
