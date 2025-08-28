/**
 * FILE: ./server.js
 * DESC: Main server entry point for the multi-tenant ERP system.
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
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);
app.use(morgan('dev'));

// ========================
// 📁 Static File Serving
// ========================
const UPLOADS_DIR =
  process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, 'public', 'uploads');

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
const siteConfigRoutes = require('./routes/site'); // تأكد من اسم الملف صحيح
const emailRoutes = require('./routes/emails');

// 🚏 Mount Routes
app.use('/provision', isSuperAdmin, provisioningRoutes);
app.use('/users', identifyTenant, userRoutes);
app.use('/customers', identifyTenant, customerRoutes);
app.use('/products', identifyTenant, productRoutes);
app.use('/orders', identifyTenant, orderRoutes);
app.use('/site-config', identifyTenant, siteConfigRoutes);
app.use('/emails', emailRoutes);

// ✅ Root Route
app.get("/", (req, res) => {
  res.send("✅ ERP API is running on Vercel!");
});

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
// 🚀 Export app (Vercel uses this)
// ========================
module.exports = app;
