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
app.use(cors());
app.use(express.json());
app.use(helmet()); // Security headers
app.use(morgan('dev')); // Logging

// ✅ Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
fs.promises.mkdir(uploadDir, { recursive: true }).catch(console.error);

// ✅ Serve uploaded images
app.use('/uploads', express.static(uploadDir));

// ✅ Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
     
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
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
app.use('/products', productRoutes); // Product Management Routes
app.use('/orders', orderRoutes);
app.use('/authuser', authroutesuser);

// ✅ Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.message);
  res.status(500).json({ message: 'Internal Server Error' });
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
