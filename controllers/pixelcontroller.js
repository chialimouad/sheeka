// controllers/siteConfigController.js

const PixelModel = require('../models/Pixel');
const SiteConfig = require('../models/SiteConfig'); // You will need a SiteConfig model for this
const { validationResult, param } = require('express-validator');

// =========================
// 픽셀 핸들러 (테넌트 인식)
// =========================

const PixelController = {
    /**
     * @desc    새 Facebook 또는 TikTok 픽셀 ID를 저장합니다.
     * @route   POST /api/pixels
     * @access  Private (Admin)
     */
    postPixel: async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { fbPixelId, tiktokPixelId } = req.body;
            const tenantId = req.user.tenantId; // 'protect' 미들웨어에서 제공

            const newPixel = await PixelModel.createPixelForTenant({
                fbPixelId,
                tiktokPixelId,
                tenantId
            });

            res.status(201).json({
                message: '픽셀 ID가 성공적으로 저장되었습니다!',
                pixel: newPixel
            });
        } catch (error) {
            console.error('픽셀 ID 저장 오류:', error);
            res.status(error.statusCode || 500).json({ message: error.message || '픽셀 ID 저장에 실패했습니다.' });
        }
    },

    /**
     * @desc    현재 테넌트의 모든 저장된 픽셀 항목을 가져옵니다.
     * @route   GET /api/pixels
     * @access  Private (Admin)
     */
    getPixels: async (req, res) => {
        try {
            const tenantId = req.user.tenantId;
            const pixels = await PixelModel.getAllPixelsForTenant(tenantId);
            res.status(200).json({
                message: '모든 픽셀 ID를 성공적으로 가져왔습니다!',
                pixels
            });
        } catch (error) {
            console.error('픽셀 ID 가져오기 오류:', error);
            res.status(500).json({ message: '픽셀 ID를 가져오는 데 실패했습니다.' });
        }
    },

    /**
     * @desc    ID로 특정 픽셀 항목을 삭제합니다.
     * @route   DELETE /api/pixels/:id
     * @access  Private (Admin)
     */
    deletePixel: [
        param('id').isMongoId().withMessage('잘못된 픽셀 ID 형식입니다.'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            try {
                const pixelId = req.params.id;
                const tenantId = req.user.tenantId;

                const deletedPixel = await PixelModel.deletePixelForTenant(pixelId, tenantId);

                if (!deletedPixel) {
                    return res.status(404).json({ message: '픽셀 ID를 찾을 수 없거나 이미 삭제되었습니다.' });
                }

                res.status(200).json({
                    message: '픽셀 ID가 성공적으로 삭제되었습니다!',
                    pixel: deletedPixel
                });
            } catch (error) {
                console.error('픽셀 ID 삭제 오류:', error);
                res.status(500).json({ message: '픽셀 ID 삭제에 실패했습니다.' });
            }
        }
    ]
};

// =========================
// サイト設定ハンドラ (テナント対応)
// =========================

const SiteConfigController = {
    /**
     * @desc    現在のテナントのサイト全体の構成を提供します。
     * @route   GET /api/site-config
     * @access  Public
     */
    getSiteConfig: async (req, res) => {
        try {
            const tenantId = req.tenantId; // `identifyTenant` ミドルウェアから

            // データベースからサイト設定とピクセル設定を並行して取得します
            const [siteConfig, pixelConfig] = await Promise.all([
                SiteConfig.findOne({ tenantId }).lean(), // サイト設定モデルから取得
                PixelModel.getLatestPixelConfigForTenant(tenantId)
            ]);

            if (!siteConfig) {
                return res.status(404).json({ message: 'このクライアントのサイト設定が見つかりません。' });
            }

            // データベースからのデータとピクセル設定を結合します
            const fullConfig = {
                ...siteConfig, // サイト名、色、配送料など
                facebookPixelId: pixelConfig ? pixelConfig.facebookPixelId : null,
                tiktokPixelId: pixelConfig ? pixelConfig.tiktokPixelId : null,
            };

            res.status(200).json(fullConfig);
        } catch (error) {
            console.error('サイト設定の取得エラー:', error);
            res.status(500).json({ message: 'サイト設定の取得に失敗しました。' });
        }
    }
    // ここにサイト設定を更新するための PUT/POST ハンドラを追加できます
};

module.exports = { PixelController, SiteConfigController };
