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
const productRoutes = require('./routes/productRoutes'); // Import productRoutes
const productController = require('./controllers/productController'); // Import productController directly

dotenv.config(); // Load .env variables

const app = express();

// ========================
// 📦 Middleware
// ========================
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// ========================
// 📁 Static Files (for legacy local file support, optional with Cloudinary)
// ========================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir)); // Serve static files from uploads

// ========================
// 🌐 MongoDB Connection
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
// 🚏 Routes
// ========================
app.use('/auth', authRoutes);
app.use('/authuser', authroutesuser);
app.use('/products', productRoutes); // All product-related routes are handled here
app.use('/orders', orderRoutes);

// New route for promo image uploads under /uploads/promo
// This uses the multer upload middleware and controller function from productController.
// Note: This creates an *additional* endpoint for promo image uploads.
// The existing endpoint at POST /products/promo (defined in productRoutes.js) also works.
app.post(
  '/uploads/promo',
  productController.uploadPromo.array('images', 5), // Correctly reference from productController
  productController.uploadPromoImages // Correctly reference from productController
);


// ========================
// ❌ 404 Handling
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
// 🚀 Server Start
// ========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
