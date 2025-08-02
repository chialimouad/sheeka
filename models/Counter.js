// models/Counter.js
const mongoose = require('mongoose');

/**
 * @desc Defines the schema for a counter document.
 * This is used to generate auto-incrementing IDs atomically, preventing race conditions.
 */
const counterSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        required: true 
    },
    seq: { 
        type: Number, 
        default: 1000 // The sequence will start at 1001
    }
});

module.exports = mongoose.model('Counter', counterSchema);
