const PixelModel = require('../models/pixel');

const PixelController = {
  postPixel: async (req, res) => {
    const fbPixelId = req.body.fbPixelId?.trim();
    const tiktokPixelId = req.body.tiktokPixelId?.trim();

    if (!fbPixelId && !tiktokPixelId) {
      return res.status(400).json({
        message: 'At least one of fbPixelId or tiktokPixelId is required.'
      });
    }

    try {
      const newPixel = await PixelModel.createPixel({ fbPixelId, tiktokPixelId });
      res.status(201).json({
        message: 'Pixel IDs stored successfully!',
        pixel: newPixel
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: 'A pixel entry with one of the provided IDs already exists.',
          error: error.message
        });
      }
      console.error('Error saving pixel IDs:', error);
      res.status(500).json({ message: 'Failed to save pixel IDs.', error: error.message });
    }
  },

  getPixels: async (req, res) => {
    try {
      const pixels = await PixelModel.getAllPixels();
      res.status(200).json({
        message: 'Fetched all pixel IDs successfully!',
        pixels
      });
    } catch (error) {
      console.error('Error fetching pixel IDs:', error);
      res.status(500).json({ message: 'Failed to fetch pixel IDs.', error: error.message });
    }
  }
};

module.exports = PixelController;
