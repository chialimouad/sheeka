const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const multer = require('multer');

// --- Mongoose Schema and Model for PromoImages ---
// This schema defines how your promotional image URLs will be stored in the database.
const PromoImageSchema = new mongoose.Schema({
    url: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

// Use mongoose.models.PromoImage to prevent re-compiling the model if it's already defined elsewhere.
const PromoImage = mongoose.models.PromoImage || mongoose.model('PromoImage', PromoImageSchema);

// --- Multer Configuration ---
// Configure Multer storage for uploaded files.
// IMPORTANT: For production on platforms like Render, consider cloud storage (AWS S3, Cloudinary)
// as local filesystem storage is ephemeral.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        // Create the uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate a unique filename using a timestamp to prevent name collisions
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Initialize Multer upload middleware with the configured storage.
const upload = multer({ storage: storage });

// --- ProductController Placeholder ---
// This object encapsulates the logic for product and promo image operations.
const productController = {
    upload: upload, // Export Multer middleware

    /**
     * Handles the upload of promotional images and saves their URLs to the database.
     * @param {Object} req - The request object, containing uploaded files (`req.files`).
     * @param {Object} res - The response object.
     */
    uploadPromoImages: async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: 'No image files provided for upload.' });
            }

            const uploadedUrls = [];
            for (const file of req.files) {
                // Construct the full URL for the uploaded image.
                // This assumes your server serves static files from a '/uploads' route.
                // Replace 'https://sheeka.onrender.com' with your actual base URL or a dynamic one.
                const imageUrl = `https://sheeka.onrender.com/uploads/${file.filename}`;

                // Create a new PromoImage document and save its URL to the database.
                const newPromoImage = new PromoImage({ url: imageUrl });
                await newPromoImage.save();
                uploadedUrls.push(imageUrl);
            }

            res.status(200).json({ message: 'Promo images uploaded and database references saved successfully!', urls: uploadedUrls });
        } catch (error) {
            console.error('Error in uploadPromoImages:', error);
            if (error.code === 11000) { // Mongoose duplicate key error
                return res.status(409).json({ message: 'One or more images with the same URL already exist in the database.' });
            }
            res.status(500).json({ message: 'Failed to upload promo images due to server error.', error: error.message });
        }
    },

    /**
     * Fetches all promotional image URLs from the database.
     * @param {Object} req - The request object.
     * @param {Object} res - The response object.
     */
    getProductImagesOnly: async (req, res) => {
        try {
            const promoImages = await PromoImage.find({}, 'url -_id'); // Only return 'url' field
            const urls = promoImages.map(img => img.url);
            res.status(200).json(urls);
        } catch (error) {
            console.error('Error in getProductImagesOnly:', error);
            res.status(500).json({ message: 'Failed to fetch promotional images from database.', error: error.message });
        }
    },

    /**
     * Handles the deletion of a promotional image by its URL.
     * Attempts to delete the file from the filesystem first, then the database record.
     * @param {Object} req - The request object, expecting `req.body.url`.
     * @param {Object} res - The response object.
     */
    deletePromoImage: async (req, res) => {
        try {
            const imageUrl = req.body.url; // Expecting the full image URL from the client
            if (!imageUrl) {
                return res.status(400).json({ message: 'Image URL is required in the request body for deletion.' });
            }

            // Extract the filename from the full image URL.
            // Assumes URLs are in the format: "https://your-domain.com/uploads/your-filename.png"
            const urlParts = imageUrl.split('/uploads/');
            const fileName = urlParts.length > 1 ? urlParts[1] : null;

            if (!fileName) {
                console.warn(`Invalid image URL format provided for deletion: ${imageUrl}. Could not extract filename.`);
                return res.status(400).json({ message: 'Invalid image URL format. Could not extract filename for deletion.' });
            }

            // Construct the absolute path to the image file on the server's filesystem.
            const filePath = path.join(__dirname, '..', 'uploads', fileName);

            // Use a promise-based approach for fs.unlink for better async handling
            const unlinkFile = () => {
                return new Promise((resolve) => {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            if (err.code === 'ENOENT') {
                                console.warn(`Warning: File not found on server at ${filePath}. (Likely ephemeral storage or already deleted). Proceeding with database cleanup.`);
                            } else {
                                console.error(`Error deleting file from filesystem (${filePath}):`, err);
                            }
                        } else {
                            console.log(`Successfully deleted file from filesystem: ${filePath}`);
                        }
                        resolve(); // Always resolve, even on fs error, to proceed to DB cleanup
                    });
                });
            };

            await unlinkFile(); // Wait for file unlinking attempt to complete

            // Attempt to delete the image reference from the database.
            const deletedRecord = await PromoImage.findOneAndDelete({ url: imageUrl });

            if (!deletedRecord) {
                console.warn("Image URL not found in database for deletion:", imageUrl);
                return res.status(404).json({ message: 'Image URL not found in database.' });
            }

            console.log(`Successfully removed database reference for URL: ${imageUrl}.`);
            return res.json({ message: 'Image and database reference deleted successfully!' });

        } catch (error) {
            console.error("Server error during promo image deletion process:", error);
            res.status(500).json({ message: 'Server error during image deletion process.', error: error.message });
        }
    },

    // Placeholder functions for other product-related operations
    addProduct: (req, res) => res.status(501).json({ message: 'Not Implemented: addProduct functionality' }),
    getProducts: (req, res) => res.status(501).json({ message: 'Not Implemented: getProducts functionality' }),
    updateProduct: (req, res) => res.status(501).json({ message: 'Not Implemented: updateProduct functionality' }),
    deleteProduct: (req, res) => res.status(501).json({ message: 'Not Implemented: deleteProduct functionality' }),
};


// =========================
// 🛍 Product Routes
// =========================

// Route to add a new product with images
router.post('/', productController.upload.array('images', 5), productController.addProduct);

// Route to get all products
router.get('/', productController.getProducts);

// Route to update an existing product
router.put('/:id', productController.updateProduct);

// Route to delete a product
router.delete('/:id', productController.deleteProduct);

// =========================
// 📸 Promo Image Upload and Deletion Routes
// =========================

// Route to upload promotional images.
// Uses Multer middleware to handle multiple file uploads (up to 5 images).
router.post('/promo', productController.upload.array('images', 5), productController.uploadPromoImages);

// Route to get all promotional image URLs.
router.get('/promo', productController.getProductImagesOnly);

// Route to delete a promotional image by its URL.
router.delete('/promo', productController.deletePromoImage); // Use the new function from controller

module.exports = router;