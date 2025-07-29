// routes/orderRoutes.js

const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const mongoose = require('mongoose'); // Import Mongoose to use ObjectId validation
dotenv.config(); // Load environment variables from .env file

const router = express.Router();

// Import Mongoose Models
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Middleware to extract client ID from JWT token
const authenticateClient = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            // Use the secret from environment variables, with a fallback
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mouadsecret');
            req.client = {
                clientId: decoded.id
            };
        } catch (err) {
            // Token is invalid, proceed without client info.
            // Subsequent logic will handle authorization checks.
        }
    }
    next();
};


// Helper function to restore stock for an order
const restoreStock = async (order) => {
    for (const item of order.products) {
        await Product.findByIdAndUpdate(item.productId, {
            $inc: {
                quantity: item.quantity
            }
        });
    }
};

// POST: Create a new order
router.post('/', async (req, res) => {
    const {
        fullName,
        phoneNumber,
        wilaya,
        commune,
        address,
        products,
        status,
        notes,
        barcodeId
    } = req.body;

    // --- Basic Validation ---
    if (!fullName || !phoneNumber || !wilaya || !commune || !products || products.length === 0) {
        return res.status(400).json({
            message: 'Missing required fields.'
        });
    }

    const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({
            message: 'Invalid Algerian phone number format.'
        });
    }

    const processedProducts = [];
    let totalItemsCount = 0;

    try {
        // --- Process and Validate Products ---
        for (const item of products) {
            const {
                productId,
                quantity,
                color,
                size
            } = item;
            if (!productId || !quantity || !color || !size) {
                throw new Error('Each product must include ID, quantity, color, and size.');
            }

            // --- ATOMIC STOCK UPDATE ---
            // Atomically find the product and decrement quantity if stock is sufficient.
            // This prevents race conditions.
            const updatedProduct = await Product.findOneAndUpdate({
                _id: productId,
                quantity: {
                    $gte: quantity
                } // Check for sufficient stock
            }, {
                $inc: {
                    quantity: -quantity
                } // Decrement stock
            }, {
                new: false
            } // Return original doc before update if needed, null if conditions fail
            );

            if (!updatedProduct) {
                // This block runs if product not found OR quantity is insufficient
                const product = await Product.findById(productId); // Check which case it is
                const errorMessage = product ?
                    `Insufficient stock for product: ${product.name}. Available: ${product.quantity}, Requested: ${quantity}` :
                    `Product with ID ${productId} not found.`;
                throw new Error(errorMessage);
            }

            // Add product details for the order, including the denormalized name
            processedProducts.push({
                productId,
                name: updatedProduct.name, // Store the product name
                quantity,
                color,
                size
            });

            totalItemsCount += quantity; // Correctly calculate total items
        }

        // --- Create and Save the Order ---
        const newOrder = new Order({
            fullName,
            phoneNumber,
            wilaya,
            commune,
            address,
            products: processedProducts, // Use the processed list
            totalItemsCount, // Use the correct total item count
            status: status || 'pending',
            notes: notes || '',
            barcodeId: barcodeId || null
        });

        await newOrder.save();
        res.status(201).json({
            message: 'Order created successfully',
            order: newOrder
        });

    } catch (error) {
        // --- ROLLBACK LOGIC ---
        // If order creation fails after stock has been decremented, restore the stock.
        if (processedProducts.length > 0) {
            for (const item of processedProducts) {
                await Product.findByIdAndUpdate(item.productId, {
                    $inc: {
                        quantity: item.quantity
                    }
                });
            }
        }

        console.error('Create order error:', error);
        res.status(500).json({
            message: 'Server error during order creation.',
            error: error.message
        });
    }
});


// GET: Count of all orders
router.get('/count', async (req, res) => {
    try {
        const count = await Order.countDocuments();
        res.status(200).json({
            count
        });
    } catch (error) {
        console.error('Count orders error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});


// GET: All orders
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email')
            .sort({
                createdAt: -1
            }); // Sort by newest first

        // No need to manually format here if product name is denormalized
        // The frontend can construct image URLs using an env variable
        res.status(200).json(orders);
    } catch (error) {
        console.error('Fetch orders error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});


// GET: Single order by ID
router.get('/:orderId', async (req, res) => {
    try {
        // --- ADDED VALIDATION ---
        if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
            return res.status(400).json({
                message: 'Invalid order ID format.'
            });
        }

        const order = await Order.findById(req.params.orderId)
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!order) {
            return res.status(404).json({
                message: 'Order not found.'
            });
        }
        res.status(200).json(order);
    } catch (error) {
        console.error('Fetch order error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});


// PATCH: Update order status and notes
router.patch('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const {
            fullName,
            phoneNumber,
            wilaya,
            commune,
            address,
            notes,
            assignedTo,
            barcodeId
        } = req.body;

        // Validate orderId
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                message: 'Invalid order ID format.'
            });
        }

        // Build update fields
        const updateFields = {};
        if (fullName !== undefined) updateFields.fullName = fullName;
        if (wilaya !== undefined) updateFields.wilaya = wilaya;
        if (commune !== undefined) updateFields.commune = commune;
        if (address !== undefined) updateFields.address = address;
        if (notes !== undefined) updateFields.notes = notes;
        if (barcodeId !== undefined) updateFields.barcodeId = barcodeId;

        if (phoneNumber !== undefined) {
            const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({
                    message: 'Invalid phone number format.'
                });
            }
            updateFields.phoneNumber = phoneNumber;
        }

        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                updateFields.assignedTo = null;
            } else {
                if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
                    return res.status(400).json({
                        message: 'Invalid assigned user ID format.'
                    });
                }

                const user = await User.findById(assignedTo);
                if (!user) {
                    return res.status(400).json({
                        message: 'Assigned user not found.'
                    });
                }

                updateFields.assignedTo = assignedTo;
            }
        }

        if (Object.keys(updateFields).length === 0) {
            console.warn('⚠️ PATCH request received with no valid fields:', req.body);
            return res.status(400).json({
                message: 'No valid fields provided for update.'
            });
        }

        // ✅ Perform the update
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { $set: updateFields },
            { new: true, runValidators: true }
        )
        .populate('confirmedBy', 'name email')
        .populate('assignedTo', 'name email');

        if (!updatedOrder) {
            return res.status(404).json({
                message: 'Order not found.'
            });
        }

        res.status(200).json({
            message: 'Order updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('🔥 Error in PATCH /orders/:orderId');
        console.error('Order ID:', req.params.orderId);
        console.error('Body:', req.body);
        console.error('Full error:', error);

        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});



// PATCH: General order update (customer details, assignment, etc.)
router.patch('/:orderId', async (req, res) => {
    try {
        const {
            orderId
        } = req.params;
        const updateFields = {};
        const {
            fullName,
            phoneNumber,
            wilaya,
            commune,
            address,
            notes,
            assignedTo,
            barcodeId
        } = req.body;

        // --- ADDED VALIDATION ---
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                message: 'Invalid order ID format.'
            });
        }

        if (fullName !== undefined) updateFields.fullName = fullName;
        if (wilaya !== undefined) updateFields.wilaya = wilaya;
        if (commune !== undefined) updateFields.commune = commune;
        if (address !== undefined) updateFields.address = address;
        if (notes !== undefined) updateFields.notes = notes;
        if (barcodeId !== undefined) updateFields.barcodeId = barcodeId;

        if (phoneNumber !== undefined) {
            const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({
                    message: 'Invalid phone number format.'
                });
            }
            updateFields.phoneNumber = phoneNumber;
        }

        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                updateFields.assignedTo = null;
            } else {
                // --- ADDED VALIDATION ---
                if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
                    return res.status(400).json({
                        message: 'Invalid assigned user ID format.'
                    });
                }
                const user = await User.findById(assignedTo);
                if (!user) {
                    return res.status(400).json({
                        message: 'Assigned user not found.'
                    });
                }
                updateFields.assignedTo = assignedTo;
            }
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({
                message: 'No valid fields provided for update.'
            });
        }

        const updatedOrder = await Order.findByIdAndUpdate(orderId, {
                $set: updateFields
            }, {
                new: true,
                runValidators: true
            })
            .populate('confirmedBy', 'name email')
            .populate('assignedTo', 'name email');

        if (!updatedOrder) return res.status(404).json({
            message: 'Order not found.'
        });

        res.status(200).json({
            message: 'Order updated successfully',
            order: updatedOrder
        });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});


// DELETE: Remove order
router.delete('/:orderId', async (req, res) => {
    try {
        const {
            orderId
        } = req.params;

        // --- ADDED VALIDATION ---
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                message: 'Invalid order ID format.'
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found.'
            });
        }

        // --- STOCK RESTORATION ON DELETE ---
        // Only restore stock if the order wasn't already cancelled or returned,
        // to prevent restoring stock twice.
        if (order.status !== 'cancelled' && order.status !== 'returned') {
            await restoreStock(order);
        }

        await Order.findByIdAndDelete(orderId);
        res.status(200).json({
            message: 'Order deleted successfully.'
        });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;
