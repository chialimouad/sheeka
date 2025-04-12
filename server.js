const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orders');
const authroutesuser = require('./routes/authroutesuser');
const productRoutes = require('./routes/productRoutes');

// ✅ Load environment variables
dotenv.config();

// ✅ App Initialization
const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());          // Security headers
app.use(morgan('dev'));     // Request logger

// ✅ Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
fs.promises.mkdir(uploadDir, { recursive: true }).catch(console.error);

// ✅ Serve static image files
app.use('/uploads', express.static(uploadDir));

// ✅ Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
     
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};
connectDB();

// ✅ Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ✅ Routes
app.use('/auth', authRoutes);
app.use('/authuser', authroutesuser);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// ✅ Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
