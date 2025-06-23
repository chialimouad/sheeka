const express = require('express');
const router = express.Router();
const siteConfigController = require('../controllers/site');

// GET site configuration
router.get('/', siteConfigController.getSiteConfig);

// PUT (update) site configuration
router.put('/', siteConfigController.updateSiteConfig);

module.exports = router;
