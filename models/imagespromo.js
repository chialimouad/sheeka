const mongoose = require('mongoose');

const promoimgschema = new mongoose.Schema({
  images: { type: [String], required: true },
 
}, { timestamps: true }); // ✅ Adds createdAt & updatedAt fields automatically

module.exports = mongoose.model('promoschema', promoimgschema);
