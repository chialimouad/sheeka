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
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// ========================
// 📁 Static Files Setup
// ========================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

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
// 🛠️ Route Validation Helper
// ========================
/**
 * Validates that a module is a valid Express router.
 * Throws a descriptive error if the validation fails.
 * @param {string} routePath - The path the router will be mounted on (for error logging).
 * @param {any} routerModule - The imported module to validate.
 * @returns {Function} The validated router module.
 */
const validateRouter = (routePath, routerModule) => {
    if (typeof routerModule !== 'function') {
        // This handles the common mistake of exporting { router } instead of router
        if (typeof routerModule === 'object' && routerModule !== null && typeof routerModule.router === 'function') {
            throw new Error(
                `The route module for '${routePath}' is exported incorrectly. ` +
                `It seems you exported an object like { router }. Please export the router directly with 'module.exports = router'.`
            );
        }
        // Generic error for other invalid types
        throw new TypeError(
            `The module for route '${routePath}' did not export a valid Express router. ` +
            `Expected a function, but got ${typeof routerModule}.`
        );
    }
    return routerModule;
};


// ========================
// 🚏 Mount Routes
// ========================
try {
    app.use('/auth', validateRouter('/auth', authRoutes));
    app.use('/authuser', validateRouter('/authuser', authroutesuser));
    app.use('/products', validateRouter('/products', productRoutes));
    app.use('/orders', validateRouter('/orders', orderRoutes));
    app.use('/api/site-config', validateRouter('/api/site-config', siteConfigRoutes));
    app.use('/api/emails', validateRouter('/api/emails', emailRoutes));
    app.use('/site', validateRouter('/site', pixelRoutes));
    app.use('/countorder', validateRouter('/countorder', ordercount));
    app.use('/visitors', validateRouter('/visitors', visitor));
} catch (error) {
    console.error('❌ Error mounting routes:', error.message);
    process.exit(1); // Exit if routes are misconfigured
}


// ========================
// ❌ 404 Not Found Handler
// ========================
app.use((req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
});

// ========================
// 🧯 Global Error Handler
// ========================
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack);
    res.status(err.statusCode || 500).json({
        message: err.message || 'Internal Server Error',
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
