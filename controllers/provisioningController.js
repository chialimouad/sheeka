const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

/**
 * @desc Creates a new client ERP instance (tenant)
 * @route POST /api/provision/client
 * @access Private (Super Admin Only)
 */
const provisionNewClient = async (req, res) => {
    try {
        // ✅ Validate request
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

        if (!clientName || !adminEmail || !adminPassword) {
            return res.status(400).json({ message: "❌ Required fields are missing." });
        }

        // ✅ Generate tenant ID (format: clientnameYYYYsheekaltd)
        const currentYear = new Date().getFullYear();
        const sanitizedName = clientName.toLowerCase().replace(/\s+/g, '');
        const tenantId = `${sanitizedName}${currentYear}sheekaltd`;

        // ✅ Encrypt admin password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // ✅ Define tenant directory
        const tenantDir = path.join(__dirname, '..', 'tenants', tenantId);

        // Check if already exists
        if (fs.existsSync(tenantDir)) {
            return res.status(409).json({ message: `❌ Tenant '${tenantId}' already exists.` });
        }

        // ✅ Create tenant directory
        fs.mkdirSync(tenantDir, { recursive: true });

        // ✅ Create configuration object
        const config = {
            tenantId,
            clientName,
            adminEmail,
            hashedPassword,
            cloudinary: {
                cloudName: cloudinaryCloudName || '',
                apiKey: cloudinaryApiKey || '',
                apiSecret: cloudinaryApiSecret || ''
            }
        };

        // ✅ Save config file
        const configPath = path.join(tenantDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        console.log(`✅ Tenant created at: ${configPath}`);

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
