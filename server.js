const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const productRoutes = require('./routes/productRoutes');

dotenv.config();

const app = express();

// Middleware to parse JSON and handle file uploads
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded images

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Routes
app.use('/api', productRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});