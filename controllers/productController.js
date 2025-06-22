// controllers/productController.js
const Product = require('../models/Product');
const PromoImage = require('../models/imagespromo');
const Collection = require('../models/Collection');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// =========================
// 📦 Multer Setup
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const safeFilename = file.originalname
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, `${Date.now()}-${safeFilename}`);
  },
});

const upload = multer({ storage });
exports.upload = upload;
const uploadPromo = multer({ storage });
exports.uploadPromo = uploadPromo;

// =========================
// 📸 Promo Image Handlers
// =========================
exports.getProductImagesOnly = async (req, res) => {
    try {
        const promos = await PromoImage.find({}, 'images');
        const allImages = promos.flatMap(p =>
            p.images.map(img => `https://sheeka.onrender.com${img}`)
        );
        res.json(allImages);
    } catch (error) {
        console.error('❌ Error fetching promo images:', error);
        res.status(500).json({ message: 'Error fetching promo images' });
    }
};

exports.uploadPromoImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        const images = req.files.map(file => `/uploads/${file.filename}`);
        const newPromo = new PromoImage({ images });
        await newPromo.save();
        res.status(201).json(newPromo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePromoImage = async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ message: 'Image URL is required' });
        }

        const relativePath = new URL(imageUrl).pathname;
        const filePath = path.join(__dirname, '..', relativePath);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File does not exist on disk' });
        }

        fs.unlink(filePath, async (err) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to delete image from disk' });
            }

            const dbResult = await PromoImage.updateMany({}, { $pull: { images: relativePath } });
            await PromoImage.deleteMany({ images: { $size: 0 } });

            res.json({ message: '✅ Image deleted', dbResult });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// =========================
// 🏢 Product Handlers
// =========================
exports.addProduct = async (req, res) => {
    try {
        const { name, description, quantity, price, variants } = req.body;

        if (!name || !description || !quantity || !price) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        let parsedVariants = [];
        if (variants) {
            try {
                parsedVariants = JSON.parse(variants);
                if (!Array.isArray(parsedVariants)) {
                    return res.status(400).json({ error: 'Variants should be an array' });
                }
            } catch {
                return res.status(400).json({ error: 'Invalid variants format' });
            }
        }

        const images = req.files.map(file => `/uploads/${file.filename}`);

        const newProduct = new Product({
            name,
            description,
            quantity,
            price,
            images,
            variants: parsedVariants
        });

        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        const updated = products.map(p => ({
            ...p._doc,
            images: p.images.map(img => `https://sheeka.onrender.com${img}`)
        }));
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products' });
    }
};
exports.getProductById = async (req, res) => {
  console.log('📥 getProductById called with id:', req.params.id); // DEBUG

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({
      ...product._doc,
      images: product.images.map(img => `https://sheeka.onrender.com${img}`)
    });
  } catch (error) {
    console.error('❌ getProductById failed:', error);
    res.status(500).json({ error: error.message });
  }
};


exports.updateProduct = async (req, res) => {
    try {
        const { name, description, quantity, price } = req.body;
        const updatedFields = { name, description, quantity, price };

        const product = await Product.findByIdAndUpdate(req.params.id, updatedFields, { new: true });
        if (!product) return res.status(404).json({ error: 'Product not found' });

        res.json({ message: 'Product updated successfully', product });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// =========================
// 🛒 Collection Handlers
// =========================
exports.getCollections = async (req, res) => {
  try {
    const collections = await Collection.find()
      .populate({
        path: 'productIds',
        select: 'name images price',
      })
      .lean();

    const updatedCollections = collections.map((collection, i) => {
      try {
        const populatedProducts = Array.isArray(collection.productIds)
          ? collection.productIds
              .filter(product => product && typeof product === 'object')
              .map(product => {
                const images = Array.isArray(product.images)
                  ? product.images
                      .filter(img => typeof img === 'string')
                      .map(img => `https://sheeka.onrender.com${img}`)
                  : [];

                return {
                  _id: product._id,
                  name: product.name,
                  price: product.price,
                  images,
                };
              })
          : [];

        return {
          _id: collection._id,
          name: collection.name,
          thumbnailUrl: typeof collection.thumbnailUrl === 'string' && collection.thumbnailUrl.trim() !== ''
            ? collection.thumbnailUrl
            : 'https://placehold.co/150x150/EEEEEE/333333?text=No+Image',
          productIds: populatedProducts,
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt,
        };
      } catch (err) {
        console.error(`❌ Error processing collection at index ${i}:`, err);
        return {
          _id: collection._id,
          name: collection.name,
          thumbnailUrl: 'https://placehold.co/150x150/EEEEEE/333333?text=No+Image',
          productIds: [],
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt,
        };
      }
    });

    res.json(updatedCollections);
  } catch (error) {
    console.error('❌ Error fetching collections:', error);
    res.status(500).json({
      error: error.message,
    });
  }
};

exports.addCollection = async (req, res) => {
  try {
    const { name, thumbnailUrl, productIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Collection name is required.' });
    }

    if (productIds && !Array.isArray(productIds)) {
      return res.status(400).json({ error: 'productIds must be an array.' });
    }

    const newCollection = new Collection({
      name,
      thumbnailUrl,
      productIds: productIds || [],
    });

    await newCollection.save();
    res.status(201).json(newCollection);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Collection with this name already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.updateCollection = async (req, res) => {
  try {
    const { name, thumbnailUrl, productIds } = req.body;

    const updatedFields = { name, thumbnailUrl, productIds };
    const collection = await Collection.findByIdAndUpdate(req.params.id, updatedFields, { new: true });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json({ message: 'Collection updated successfully', collection });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Collection with this name already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCollection = async (req, res) => {
  try {
    const collection = await Collection.findByIdAndDelete(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
