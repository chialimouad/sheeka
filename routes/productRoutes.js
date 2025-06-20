// backend/routes/productRoutes.js
const express = require('express');
const router = express.Router();
// Assuming productController handles multer upload middleware
// In a real application, you would typically import your existing productController:
// const productController = require('../controllers/productController');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const multer = require('multer'); // Used for handling file uploads

// --- Mongoose Schema and Model for PromoImages ---
// This schema defines how your promotional image URLs will be stored in the database.
// It assumes promo images are stored in their own collection, separate from 'products'.
const PromoImageSchema = new mongoose.Schema({
    url: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now } // Timestamp for when the image was added
});

// Create the Mongoose model for PromoImage.
// Use mongoose.models.PromoImage to prevent re-compiling the model if it's already defined elsewhere.
const PromoImage = mongoose.models.PromoImage || mongoose.model('PromoImage', PromoImageSchema);

// --- Start of ProductController Placeholder ---
// This section simulates the content of your `controllers/productController.js` file.
// You should copy the relevant parts into your actual `productController.js`.

// Configure Multer storage for uploaded files.
// Files will be saved in a 'uploads' directory relative to the project root.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        // Create the uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); // Callback with the destination directory
    },
    filename: function (req, file, cb) {
        // Generate a unique filename using a timestamp to prevent name collisions
        cb(null, Date.now() + '-' + file.originalname); // Callback with the generated filename
    }
});

// Initialize Multer upload middleware with the configured storage.
const upload = multer({ storage: storage });

// Define the functions that would typically be in your productController.js
const productController = {
    // Export the multer upload middleware to be used in routes
    upload: upload,

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
                const imageUrl = `https://sheeka.onrender.com/uploads/${file.filename}`;

                // Create a new PromoImage document and save its URL to the database.
                const newPromoImage = new PromoImage({ url: imageUrl });
                await newPromoImage.save();
                uploadedUrls.push(imageUrl);
            }

            // Respond with success message and the URLs of uploaded images.
            res.status(200).json({ message: 'Promo images uploaded and database references saved successfully!', urls: uploadedUrls });
        } catch (error) {
            console.error('Error in uploadPromoImages:', error);
            // Handle specific Mongoose duplicate key error (code 11000)
            if (error.code === 11000) {
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
            // Find all PromoImage documents and only return the 'url' field, excluding the '_id'.
            const promoImages = await PromoImage.find({}, 'url -_id');
            // Map the results to an array of just URLs.
            const urls = promoImages.map(img => img.url);
            res.status(200).json(urls); // Respond with the array of URLs
        } catch (error) {
            console.error('Error in getProductImagesOnly:', error);
            res.status(500).json({ message: 'Failed to fetch promotional images from database.', error: error.message });
        }
    },

    // Placeholder functions for other product-related operations
    addProduct: (req, res) => res.status(501).json({ message: 'Not Implemented: addProduct functionality' }),
    getProducts: (req, res) => res.status(501).json({ message: 'Not Implemented: getProducts functionality' }),
    updateProduct: (req, res) => res.status(501).json({ message: 'Not Implemented: updateProduct functionality' }),
    deleteProduct: (req, res) => res.status(501).json({ message: 'Not Implemented: deleteProduct functionality' }),
};
// --- End of ProductController Placeholder ---


// =========================
// 🛍 Product Routes (using the placeholder productController)
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
router.delete('/promo', async (req, res) => {
    try {
        const imageUrl = req.body.url; // Expecting the full image URL from the client
        if (!imageUrl) {
            return res.status(400).json({ message: 'Image URL is required in the request body for deletion.' });
        }

        // Extract the filename from the full image URL.
        // Assumes URLs are in the format: "https://sheeka.onrender.com/uploads/your-filename.png"
        const urlParts = imageUrl.split('/uploads/');
        const fileName = urlParts.length > 1 ? urlParts[1] : null;
        if (!fileName) {
            return res.status(400).json({ message: 'Invalid image URL format. Could not extract filename for deletion.' });
        }

        // Construct the absolute path to the image file on the server's filesystem.
        // This path must match where Multer saves the files.
        const filePath = path.join(__dirname, '..', 'uploads', fileName);

        // 1. Attempt to delete the image file from the server's file system.
        fs.unlink(filePath, async (err) => {
            if (err) {
                // Log the error. If it's 'ENOENT' (file not found), it means the file
                // was already deleted or never existed. We'll warn but proceed to DB cleanup.
                if (err.code === 'ENOENT') {
                    console.warn(`Warning: File not found on server at ${filePath}. Proceeding with database cleanup.`);
                } else {
                    // For other filesystem errors, log them and decide if you want to
                    // stop here or still try to delete from DB (robustness prefers trying DB).
                    console.error(`Error deleting file from filesystem (${filePath}):`, err);
                }
            }

            // 2. Attempt to delete the image reference from the database.
            try {
                // Find and delete the document in the PromoImage collection where the 'url' matches.
                const deletedRecord = await PromoImage.findOneAndDelete({ url: imageUrl });

                if (!deletedRecord) {
                    // If no record was found in the database for the given URL.
                    console.warn("Image URL not found in database for deletion:", imageUrl);
                    return res.status(404).json({ message: 'Image URL not found in database.' });
                }

                console.log(`Successfully deleted file ${filePath} and removed database reference for URL: ${imageUrl}.`);
                return res.json({ message: 'Image and database reference deleted successfully!' });

            } catch (dbError) {
                console.error("Error deleting image reference from database:", dbError);
                return res.status(500).json({ message: 'Failed to delete image reference from database.' });
            }
        });

    } catch (error) {
        console.error("Server error during promo image deletion route:", error);
        res.status(500).json({ message: 'Server error during image deletion process.' });
    }
});

module.exports = router;
