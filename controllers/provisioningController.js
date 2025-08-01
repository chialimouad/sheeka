const Client = require('../models/Client');
const User = require('../models/User');
const bcrypt = require('bcrypt');

const provisionNewClient = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Generate a clean tenantId string like 'mycompany2025sheekaltd'
    const sanitizedClientName = name.toLowerCase().replace(/\s+/g, '');
    const currentYear = new Date().getFullYear();
    const tenantIdString = `${sanitizedClientName}${currentYear}sheekaltd`;

    // Hash the password for security
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 1: Create the client
    const newClient = new Client({
      name,
      email,
      tenantId: tenantIdString,
    });

    console.log("Saving client...");
    await newClient.save();
    console.log("✅ Client created:", newClient);

    // Step 2: Create the admin user for the client
    const newAdminUser = new User({
      tenantId: newClient._id, // use ObjectId reference to the Client
      name: 'Admin',
      email,
      password: hashedPassword,
      role: 'admin',
    });

    console.log("Saving admin user...");
    await newAdminUser.save();
    console.log("✅ Admin user created:", newAdminUser);

    res.status(201).json({ message: 'Client and admin user provisioned successfully!' });
  } catch (error) {
    console.error("❌ Provisioning error:", error);
    res.status(500).json({ error: 'Server error during client provisioning.' });
  }
};

module.exports = { provisionNewClient };
