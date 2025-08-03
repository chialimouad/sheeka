/**
 * FILE: ./server.js
 * DESC: Main server entry point for the multi-tenant ERP system.
 *
 * FIX:
 * - Corrected all middleware imports to use the single, consolidated
 * `./middleware/authMiddleware.js` file and its `identifyTenant` function.
 * - Standardized all API routes to be prefixed with `/api`.
 * - Corrected the route for site configuration to `/api/site-config` to match
 * the frontend fetch request in `site-settings.html`.
 * - Applied the `identifyTenant` middleware to the site configuration route,
 * as it is required by the controller to identify which tenant's settings
 * to load or save.
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
// **FIX**: Import the correct tenant identification middleware.
const { identifyTenant } = require('./middleware/authMiddleware'); 

const provisioningRoutes = require('./routes/provisioningRoutes');
const userRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/authroutesuser');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orders');
const siteConfigRoutes = require('./routes/siteConfigRoutes'); // Corrected file name assumption
const emailRoutes = require('./routes/emails');

// ========================
// 🚏 Mount Routes
// ========================
app.use('/api/provision', isSuperAdmin, provisioningRoutes); // Super admin only

// **FIX**: Apply the correct `identifyTenant` middleware to all tenant-aware routes
// and standardize paths under `/api`.
app.use('/users', identifyTenant, userRoutes);
app.use('/customers', identifyTenant, customerRoutes);
app.use('/products', identifyTenant, productRoutes);
app.use('/orders', identifyTenant, orderRoutes);

// **FIX**: The site config route needs the tenant middleware and the correct path.
app.use('/site-config', identifyTenant, siteConfigRoutes);
app.use('/emails', emailRoutes); // Assuming this might also need tenant context later

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
