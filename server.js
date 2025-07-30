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
const pixelRoutes = require('./routes/pixel'); // ✅ Pixel routes

// ========================
// 🚏 Mount Routes
// ========================
app.use('/auth', authRoutes);
app.use('/authuser', authroutesuser);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/api/site-config', siteConfigRoutes); // This correctly mounts all routes from routes/site.js
app.use('/api/emails', emailRoutes);

// =================================================================================================
// 🚨 CRITICAL ERROR ANALYSIS 🚨
// =================================================================================================
// The error you are seeing: "TypeError: Router.use() requires a middleware function but got a Object"
// is caused by the line directly below this comment block.
//
// WHAT IT MEANS:
// Express's `app.use()` was expecting a middleware function or a router, but instead, it received a
// plain JavaScript object from the `pixelRoutes` variable.
//
// HOW TO FIX IT:
// The problem is NOT in this file (server.js). It is in the file that you are importing:
//
// 👉👉👉      ./routes/pixel.js      👈👈👈
//
// You must open `./routes/pixel.js` and ensure that you are exporting the router instance correctly.
//
// Find the last line in `./routes/pixel.js`.
//
// ✅ IT MUST BE EXACTLY THIS:
// module.exports = router;
//
// ❌ IT MUST NOT BE THIS (or anything similar):
// module.exports = { router };
//
// By making this change in `./routes/pixel.js`, the `require('./routes/pixel')` call in this file
// will receive the router function correctly, and the error will be resolved.
// =================================================================================================
app.use('/site', pixelRoutes); // ✅ Mount pixel endpoints at /site (Comment corrected)

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
