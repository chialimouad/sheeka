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

// 🚨 ERROR ANALYSIS: The error "TypeError: Router.use() requires a middleware function but got a Object"
// originates from the line below. It indicates that the `pixelRoutes` variable holds a standard object,
// not the Express Router instance that `app.use()` expects.
//
// ✅ SOLUTION: The problem is in your `./routes/pixel.js` file.
// You need to ensure that you are exporting the router instance directly.
// Open `./routes/pixel.js` and make sure the last line of the file is:
//
// module.exports = router;
//
// It should NOT be `module.exports = { router }` or any other object structure.
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
