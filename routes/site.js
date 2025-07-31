// routes/siteConfigRoutes.js

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

// Import the refactored controllers
const {
    SiteConfigController,
    PixelController
} = require('../controllers/site');

// Import the necessary middleware for security and tenant identification
const { identifyTenant } = require('../middleware/tenantMiddleware');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// ================================
// ⚙️ SITE CONFIGURATION ROUTES
// ================================

/**
 * @route   GET /api/config
 * @desc    Get the complete public site configuration for the current client
 * @access  Public
 */
router.get(
    '/',
    identifyTenant, // Identifies the client based on the request (e.g., subdomain)
    SiteConfigController.getSiteConfig
);

/**
 * @route   PUT /api/config
 * @desc    Update the main site configuration for the current client
 * @access  Private (Admin)
 */
router.put(
    '/',
    identifyTenant,
    protect, // Ensures a user is logged in
    isAdmin, // Ensures the user has admin privileges
    SiteConfigController.updateSiteConfig
);


// ================================
// 픽셀 추적 경로
// ================================

/**
 * @route   GET /api/config/pixels
 * @desc    현재 클라이언트의 모든 픽셀 구성을 가져옵니다
 * @access  Private (Admin)
 */
router.get(
    '/pixels',
    identifyTenant,
    protect,
    isAdmin,
    PixelController.getPixels
);

/**
 * @route   POST /api/config/pixels
 * @desc    현재 클라이언트에 대한 새 픽셀 구성을 만듭니다
 * @access  Private (Admin)
 */
router.post(
    '/pixels',
    identifyTenant,
    protect,
    isAdmin,
    [ // 유효성 검사 추가
        body('fbPixelId').optional().trim().notEmpty().withMessage('Facebook Pixel ID는 비워 둘 수 없습니다.'),
        body('tiktokPixelId').optional().trim().notEmpty().withMessage('TikTok Pixel ID는 비워 둘 수 없습니다.')
    ],
    PixelController.postPixel
);

/**
 * @route   DELETE /api/config/pixels/:id
 * @desc    ID로 픽셀 구성을 삭제합니다
 * @access  Private (Admin)
 */
router.delete(
    '/pixels/:id',
    identifyTenant,
    protect,
    isAdmin,
    [ // ID 형식에 대한 유효성 검사
        param('id').isMongoId().withMessage('잘못된 픽셀 ID 형식입니다.')
    ],
    PixelController.deletePixel
);

module.exports = router;
