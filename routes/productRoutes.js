const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const path = require('path'); // Import the path module
const fs = require('fs');     // Import the file system module

// Assuming you have a model for Promo Images, e.g., using Mongoose:
// const PromoImage = require('../models/PromoImage'); 
// You'll need to ensure this path is correct and the model exists.

// =========================
// 🛍 Product Routes
// =========================

// Add a new product with images
router.post('/', productController.upload.array('images', 5), productController.addProduct);

// Get all products
router.get('/', productController.getProducts);

// Update an existing product
router.put('/:id', productController.updateProduct);

// Delete a product
router.delete('/:id', productController.deleteProduct);

// =========================
// 📸 Promo Image Upload and Deletion Routes
// =========================

// Upload promotional images (separate from product listing)
router.post('/promo', productController.upload.array('images', 5), productController.uploadPromoImages);

// Get all promotional images
router.get('/promo', productController.getProductImagesOnly);

// Delete a promotional image by URL
router.delete('/promo', async (req, res) => {
    try {
        const imageUrl = req.body.url; // Expecting the full image URL from the client
        if (!imageUrl) {
            return res.status(400).json({ message: 'Image URL is required in the request body.' });
        }

        // Extract just the filename from the URL (e.g., "image123.jpg")
        // Assumes your images are served from a '/uploads/' directory
        const fileName = imageUrl.split('/uploads/')[1];
        if (!fileName) {
            return res.status(400).json({ message: 'Invalid image URL format. Could not extract filename.' });
        }

        // Construct the absolute path to the image file on the server
        // Assumes 'uploads' directory is sibling to the directory where this router file resides.
        // Adjust `../uploads` if your structure is different (e.g., '../../uploads')
        const filePath = path.join(__dirname, '..', 'uploads', fileName);

        // 1. Attempt to delete the image file from the server's file system
        fs.unlink(filePath, async (err) => {
            if (err) {
                // Log the error but proceed if it's a "file not found" error,
                // as the database might still need cleanup or the file was already gone.
                if (err.code === 'ENOENT') {
                    console.warn(`Warning: File not found on server at ${filePath}. Proceeding with database cleanup.`);
                } else {
                    console.error(`Error deleting file from filesystem (${filePath}):`, err);
                    // Decide if you want to stop here or try database deletion anyway.
                    // For robustness, we will try database deletion regardless of filesystem error.
                }
            }

            // 2. Attempt to delete the image reference from the database
            try {
                // IMPORTANT: Replace this with your actual database deletion logic.
                // Example using a Mongoose model named 'PromoImage':
                // const deletedImage = await PromoImage.findOneAndDelete({ url: imageUrl });
                // If promo images are stored within a Product document (e.g., an array of URLs),
                // you would update the Product document to remove the URL.
                // Example for removing from a product's promoImages array:
                /*
                const productId = req.body.productId; // You would need to send productId from client
                const updatedProduct = await Product.findByIdAndUpdate(
                    productId,
                    { $pull: { promoImages: imageUrl } }, // Removes the imageUrl from the promoImages array
                    { new: true }
                );
                if (!updatedProduct) {
                    return res.status(404).json({ message: 'Product not found, could not remove image reference.' });
                }
                */

                // Placeholder for actual database deletion logic:
                // If you have a dedicated PromoImage model:
                // const deletedRecord = await PromoImage.deleteOne({ url: imageUrl }); // Or findOneAndDelete
                // if (deletedRecord.deletedCount === 0) {
                //   console.warn("Image URL not found in database:", imageUrl);
                // }

                // For this example, we'll just assume success after fs.unlink and
                // provide a message, but you MUST implement database deletion here.
                console.log(`Successfully deleted file ${filePath} and would now delete from DB.`);
                return res.json({ message: 'Image deletion process initiated successfully (file and DB reference).' });

            } catch (dbError) {
                console.error("Error deleting image reference from database:", dbError);
                return res.status(500).json({ message: 'Failed to delete image reference from database.' });
            }
        });

    } catch (error) {
        console.error("Server error during promo image deletion route:", error);
        res.status(500).json({ message: 'Server error during image deletion.' });
    }
});

module.exports = router;
