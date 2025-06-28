const express = require('express');
const router = express.Router(); // Create an Express router instance

// Import controller functions
const orderCountController = require('../controllers/controller');

// Define routes:
// POST request to create or update an order count record (using upsert logic in controller)
router.post('/order-counts', orderCountController.createOrderCount);

// GET request to retrieve all order count records (optional, for viewing history)
router.get('/order-counts', orderCountController.getAllOrderCounts);

module.exports = router;