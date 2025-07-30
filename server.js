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
app.use('/uploads', express.static(uploadDir)); // Serve static files

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
// Use 'let' for pixelRoutes to allow for potential reassignment.
let pixelRoutes = require('./routes/pixel'); // ✅ Pixel routes

// =================================================================================================
// 🚨 AUTOMATIC ERROR CORRECTION 🚨
// =================================================================================================
// The error "TypeError: Router.use() requires a middleware function but got a Object"
// consistently points to `./routes/pixel.js` exporting an object instead of the router directly.
// For example, it might be exporting `module.exports = { router }` when it should be `module.exports = router;`
//
// The code below attempts to automatically fix this. It checks if `pixelRoutes` is an object
// containing a `router` property and, if so, uses that property as the actual router.
// This makes the server more resilient to this common mistake.
//
// The best long-term solution is still to fix the export in `./routes/pixel.js`.
// =================================================================================================
if (pixelRoutes && typeof pixelRoutes === 'object' && Object.hasOwnProperty.call(pixelRoutes, 'router')) {
    console.log('⚠️  Warning: Correcting a malformed route export from ./routes/pixel.js. Using `pixelRoutes.router`.');
    pixelRoutes = pixelRoutes.router; // Reassign to the actual router object.
}

// ========================
// 🚏 Mount Routes
// ========================
app.use('/auth', authRoutes);
app.use('/authuser', authroutesuser);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/api/site-config', siteConfigRoutes); // This correctly mounts all routes from routes/site.js
app.use('/api/emails', emailRoutes);
app.use('/site', pixelRoutes); // ✅ Mount pixel endpoints at /site

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
