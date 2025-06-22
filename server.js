const express = require('express');
const mongoose = require('mongoose'); // Assuming you use Mongoose for MongoDB
const cors = require('cors'); // Added based on your provided app.js
const dotenv = require('dotenv'); // Added based on your provided app.js
const path = require('path'); // Added based on your provided app.js
const fs = require('fs'); // Added based on your provided app.js
const morgan = require('morgan'); // Added based on your provided app.js
const helmet = require('helmet'); // Added based on your provided app.js

const authRoutes = require('./routes/authRoutes'); // Added based on your provided app.js
const orderRoutes = require('./routes/orders'); // Added based on your provided app.js
const authroutesuser = require('./routes/authroutesuser'); // Added based on your provided app.js
const productRoutes = require('./routes/productRoutes'); // Path to your router file

// ✅ Load environment variables
dotenv.config();

// ✅ App Initialization
const app = express();

// ✅ Middleware
app.use(cors()); // Cross-Origin Resource Sharing
app.use(express.json()); // Essential: Parses incoming JSON request bodies
// Optional: If your Flutter app sends form-urlencoded data, also include this:
// app.use(express.urlencoded({ extended: true }));
app.use(helmet());          // Security headers
app.use(morgan('dev'));     // Request logger for development

// ✅ Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
fs.promises.mkdir(uploadDir, { recursive: true }).catch(console.error);

// ✅ Serve static image files
// This allows your Flutter app to load images from paths like /uploads/image.png
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// If you have a specific promo sub-directory, ensure it's also served
// (Though typically one static route for the parent directory is sufficient)
app.use('/uploads/promo', express.static(uploadDir)); 


// ==============================================================
// Connect to MongoDB
// ==============================================================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // No need for deprecated options like useNewUrlParser, useUnifiedTopology in recent Mongoose versions
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1); // Exit process with failure
  }
};
connectDB(); // Call the connection function


// ✅ Log all requests (custom logger, `morgan` above already does this)
// You can keep this for more specific logging if needed, or remove if morgan is sufficient.
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ✅ Routes
app.use('/auth', authRoutes);
app.use('/authuser', authroutesuser);
app.use('/products', productRoutes); // All routes from productRoutes.js will be prefixed with /products
app.use('/orders', orderRoutes);

// ✅ Global Error Handler (This should always be the last middleware)
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack); // Log the full stack trace for debugging
  res.status(err.statusCode || 500).json({ // Use custom status code if available, else 500
      message: err.message || 'Internal Server Error',
      // Optionally, include error details in dev environment
      ...(process.env.NODE_ENV === 'development' && { error: err })
  });
});

// ✅ Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => { // '0.0.0.0' allows listening on all network interfaces
  console.log(`🚀 Server running on port ${PORT}`);
});
