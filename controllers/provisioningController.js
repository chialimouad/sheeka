// controllers/provisioningController.js

const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

/**
 * @desc Creates a new client ERP instance (tenant)
 * @route POST /api/provision/client
 * @access Private (Super Admin Only)
 */
const provisionNewClient = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            clientName,
            adminEmail,
            adminPassword,
            cloudinaryCloudName,
            cloudinaryApiKey,
            cloudinaryApiSecret
        } = req.body;

        // ✅ Generate tenant ID: format => clientnameYYYYsheekaltd
        const currentYear = new Date().getFullYear();
        const sanitizedName = clientName.toLowerCase().replace(/\s+/g, '');
        const tenantId = `${sanitizedName}${currentYear}sheekaltd`;

        // ✅ Encrypt admin password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // ✅ Define tenant directory
        const tenantDir = path.join(__dirname, '..', 'tenants', tenantId);
        await mkdirp(tenantDir); // Ensures the directory exists

        // ✅ Create configuration file for tenant
        const config = {
            tenantId,
            clientName,
            adminEmail,
            hashedPassword,
            cloudinary: {
                cloudName: cloudinaryCloudName,
                apiKey: cloudinaryApiKey,
                apiSecret: cloudinaryApiSecret
            }
        };

        fs.writeFileSync(
            path.join(tenantDir, 'config.json'),
            JSON.stringify(config, null, 2)
        );

        return res.status(201).json({
            message: `✅ Client '${clientName}' provisioned successfully.`,
            tenantId
        });

    } catch (error) {
        console.error('❌ Error provisioning client:', error);
        return res.status(500).json({
            message: '❌ Server error during client provisioning.'
        });
    }
};

module.exports = { provisionNewClient };
