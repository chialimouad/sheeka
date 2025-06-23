const express = require('express');
const router = express.Router();
const siteConfigController = require('../controllers/site'); // Corrected import path

// GET site configuration
router.get('/', siteConfigController.getSiteConfig);

// PUT (update) site configuration
router.put('/', siteConfigController.updateSiteConfig);

module.exports = router;
