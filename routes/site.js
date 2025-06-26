const express = require('express');
const router = express.Router();
const siteConfigController = require('../controllers/site'); // Corrected import path, assuming 'site.js' in 'controllers'

// @route   GET /api/site-config
// @desc    Get site configuration
// @access  Public
router.get('/', siteConfigController.getSiteConfig);

// @route   PUT /api/site-config
// @desc    Update full site configuration (including currentDataIndex)
// @access  Private (e.g., Admin only)
router.put('/', siteConfigController.updateSiteConfig);

// @route   PUT /api/site-config/index
// @desc    Update only the currentDataIndex field of site configuration
// @access  Private (e.g., Admin only)
router.put('/index', siteConfigController.updateCurrentDataIndex);

module.exports = router;
