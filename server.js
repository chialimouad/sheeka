const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan'); // ✅ Logging Middleware
const helmet = require('helmet'); // ✅ Security Middleware
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orders');
const authroutesuser = require('./routes/authroutesuser');
const productRoutes = require('./routes/productRoutes');

// ✅ Load environment variables
dotenv.config();

const app = express();

// ✅ Middleware
app.use(cors()); // Enable Cross-Origin Requests (CORS)
app.use(express.json()); // Parse incoming JSON requests
app.use(helmet()); // Security headers
app.use(morgan('dev')); // Logging requests

// ✅ Ensure uploads directory exists and is writable
const uploadDir = path.join(__dirname, 'uploads');
fs.promises.mkdir(uploadDir, { recursive: true }).catch(console.error);

// ✅ Serve uploaded images via static middleware (make sure this is accessible)
app.use('/uploads', express.static(uploadDir)); // Serve static files from the uploads folder

// ✅ Use the product routes for product management
app.use('/products', productRoutes);

// ✅ Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
    // Add these for more stable connection handling
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1); // Exit process if connection fails
  }
};
connectDB();

// ✅ Logging Middleware (Detailed API Logs)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ✅ Routes
app.use('/auth', authRoutes); // Authentication Routes
app.use('/orders', orderRoutes); // Orders Routes
app.use('/authuser', authroutesuser); // Auth Routes for users

// ✅ Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.message);
  res.status(500).json({ message: 'Internal Server Error' });
});

// ✅ Start the server on the specified port
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
