// --- server.js ---
// Main server entry point

require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();

// ========================
// 📦 Middleware Setup
// ========================
// Note: For production, consider configuring CORS more securely.
// Example: app.use(cors({ origin: 'https://your-frontend-domain.com' }));
app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies
app.use(helmet()); // Middleware for setting various security headers
app.use(morgan('dev')); // Middleware for logging HTTP requests in development

// ========================
// 📁 Static Files Setup
// ========================
const uploadDir = path.join(__dirname, 'uploads');
// Ensure the 'uploads' directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir)); // Serve static files from the 'uploads' directory

// ========================
// 📡 Connect to MongoDB
// ========================
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        // Exit process with failure code if database connection fails
        process.exit(1);
    }
};
connectDB();

// ========================
// 🧩 Import Route Modules
// ========================
// Note: For better maintainability, consider standardizing your route file names
// (e.g., auth.routes.js, order.routes.js).
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orders');
const authroutesuser = require('./routes/authroutesuser');
const productRoutes = require('./routes/productRoutes');
const siteConfigRoutes = require('./routes/site');
const emailRoutes = require('./routes/emails');
const pixelRoutes = require('./routes/pixel');
const ordercount = require('./routes/ordecount');
const visitor = require('./routes/visit');

// ========================
// 🚏 Mount Routes
// ========================
app.use('/auth', authRoutes);
app.use('/authuser', authroutesuser);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/api/site-config', siteConfigRoutes);
app.use('/api/emails', emailRoutes);
app.use('/site', pixelRoutes);
app.use('/countorder', ordercount);
// CORRECTED: Changed app.e to app.use
app.use('/visitors', visitor);

// ========================
// ❌ 404 Not Found Handler
// ========================
// This middleware runs if no other route matches the request
app.use((req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
});

// ========================
// 🧯 Global Error Handler
// ========================
// This middleware catches all errors passed by next(err)
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack);
    res.status(err.statusCode || 500).json({
        message: err.message || 'Internal Server Error',
        // Only show detailed error in development environment
        ...(process.env.NODE_ENV === 'development' && { error: err })
    });
});

// ========================
// 🚀 Start Server
// ========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
