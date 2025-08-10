// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '123';

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

// Middleware
app.use(express.json());
const corsOptions = {
  origin: 'https://harmonious-crumble-2ca9ba.netlify.app',
  optionsSuccessStatus: 200 // For legacy browsers
};
app.use(cors(corsOptions));

// --- Mongoose Schemas and Models ---

// Checklist Schema and Model
const checklistSchema = new mongoose.Schema({
  room: { type: String, required: true },
  date: { type: String, required: true },
  items: { type: Object, required: true },
}, { timestamps: true });

const Checklist = mongoose.model('Checklist', checklistSchema);

// StatusReport Schema and Model
const statusReportSchema = new mongoose.Schema({
  room: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, required: true },
  remarks: { type: String, default: '' },
  dateTime: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

const StatusReport = mongoose.model('StatusReport', statusReportSchema);

// 🆕 NEW: Inventory Schema and Model with custom lowStockLevel
const inventorySchema = new mongoose.Schema({
    item: { type: String, required: true, unique: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockLevel: { type: Number, required: true, min: 0, default: 0 } // Each item now has its own low stock level
}, { timestamps: true });

const Inventory = mongoose.model('Inventory', inventorySchema);


// --- Admin Login ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.status(200).json({ message: 'Login successful' });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
});

// --- Email Transporter ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


// 🆕 UPDATED: Low Stock Email Notification Function
/**
 * Sends a low stock email notification if an item's quantity is below its specific lowStockLevel.
 * @param {string} item - The name of the low-stock item.
 * @param {number} quantity - The current quantity of the item.
 * @param {number} lowStockLevel - The custom low stock threshold for this item.
 */
async function sendLowStockEmail(item, quantity, lowStockLevel) {
    if (quantity <= lowStockLevel) { // Use the item-specific threshold
        const html = `<p><strong>Urgent Low Stock Alert!</strong></p>
                      <p>The inventory for <strong>${item}</strong> is critically low. There are only <strong>${quantity}</strong> units remaining. The low stock level for this item is ${lowStockLevel}.</p>
                      <p>Please reorder this item as soon as possible.</p>`;

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER, // Sends email to self (admin)
                subject: `LOW STOCK ALERT: ${item}`,
                html,
            });
            console.log(`📧 Low stock email sent for ${item}.`);
            return true;
        } catch (emailErr) {
            console.error('❌ Low stock email sending failed:', emailErr);
            return false;
        }
    }
    return false;
}


// --- API Endpoints for Room Checklists (existing) ---

// Submit checklist
app.post('/submit-checklist', async (req, res) => {
  const { room, date, items } = req.body;

  if (!room || !date || !items) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const checklist = new Checklist({ room, date, items });
  let emailSent = false;

  try {
    await checklist.save();

    // Check for missing items
    const missingItems = Object.entries(items).filter(([, val]) => val === 'no');
    if (missingItems.length > 0) {
      const html = `<p>Room <strong>${room}</strong> on <strong>${date}</strong> is missing:</p>
        <ul>${missingItems.map(([key]) => `<li>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>`).join('')}</ul>
        <p>Please address this immediately.</p>`;

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `Urgent: Missing Items in Room ${room} on ${date}`,
          html,
        });
        console.log('📧 Email sent for missing items.');
        emailSent = true;
      } catch (emailErr) {
        console.error('❌ Email sending failed:', emailErr);
      }
    }

    res.status(201).json({ message: 'Checklist submitted successfully', checklist, emailSent });

  } catch (err) {
    console.error('❌ Error saving checklist:', err);
    res.status(500).json({ message: 'Server error while submitting checklist' });
  }
});

// Get all checklists
app.get('/checklists', async (req, res) => {
  try {
    const data = await Checklist.find().sort({ date: -1, createdAt: -1 });
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Error retrieving checklists:', err);
    res.status(500).json({ message: 'Failed to retrieve checklists' });
  }
});

// Update checklist by ID
app.put('/checklists/:id', async (req, res) => {
  try {
    const updated = await Checklist.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ message: 'Checklist not found' });
    }
    res.status(200).json({ message: 'Checklist updated successfully', updated });
  } catch (err) {
    console.error('❌ Error updating checklist:', err);
    res.status(500).json({ message: 'Update failed for checklist' });
  }
});

// Delete checklist
app.delete('/checklists/:id', async (req, res) => {
  try {
    const result = await Checklist.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Checklist not found' });
    }
    res.status(200).json({ message: 'Checklist deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting checklist:', err);
    res.status(500).json({ message: 'Delete failed for checklist' });
  }
});

// --- API Endpoints for Housekeeping Room Status Reports (existing) ---

// Submit a new status report
app.post('/submit-status-report', async (req, res) => {
  const { room, category, status, remarks, dateTime } = req.body;

  if (!room || !category || !status || !dateTime) {
    return res.status(400).json({ message: 'Missing required fields for status report' });
  }

  try {
    const newReport = new StatusReport({ room, category, status, remarks, dateTime });
    await newReport.save();
    res.status(201).json({ message: 'Status report submitted successfully', report: newReport });
  } catch (err) {
    console.error('❌ Error saving status report:', err);
    res.status(500).json({ message: 'Server error while saving status report' });
  }
});

// Get all status reports
app.get('/status-reports', async (req, res) => {
  try {
    const reports = await StatusReport.find().sort({ dateTime: -1 });
    res.status(200).json(reports);
  } catch (err) {
    console.error('❌ Error retrieving status reports:', err);
    res.status(500).json({ message: 'Failed to retrieve status reports' });
  }
});

// Update a status report by ID
app.put('/status-reports/:id', async (req, res) => {
  try {
    const updated = await StatusReport.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ message: 'Status report not found' });
    }
    res.status(200).json({ message: 'Status report updated successfully', updated });
  } catch (err) {
    console.error('❌ Error updating status report:', err);
    res.status(500).json({ message: 'Update failed for status report' });
  }
});

// Delete a status report by ID
app.delete('/status-reports/:id', async (req, res) => {
  try {
    const deleted = await StatusReport.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Status report not found' });
    }
    res.status(200).json({ message: 'Status report deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting status report:', err);
    res.status(500).json({ message: 'Delete failed for status report' });
  }
});


// --- 🆕 UPDATED: API Endpoints for Inventory Management ---

// Add or Use Inventory (Create/Update logic combined)
app.post('/inventory', async (req, res) => {
    const { item, quantity, action, lowStockLevel } = req.body;
    
    if (!item || !quantity || !action) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        let inventoryItem = await Inventory.findOne({ item: { $regex: new RegExp(`^${item}$`, 'i') } });
        let lowStockEmailSent = false;
        
        if (inventoryItem) {
            // Item exists, update quantity
            if (action === 'add') {
                inventoryItem.quantity += quantity;
            } else if (action === 'use') {
                if (inventoryItem.quantity < quantity) {
                    return res.status(400).json({ message: `Cannot use ${quantity} units. Only ${inventoryItem.quantity} are in stock.` });
                }
                inventoryItem.quantity -= quantity;
            }
            await inventoryItem.save();
            lowStockEmailSent = await sendLowStockEmail(inventoryItem.item, inventoryItem.quantity, inventoryItem.lowStockLevel);
            return res.status(200).json({ message: 'Inventory updated successfully', lowStockEmailSent });
        } else if (action === 'add') {
            // Item does not exist, create a new one only if action is 'add'
            // Use provided lowStockLevel or default to 10
            inventoryItem = new Inventory({ item, quantity, lowStockLevel: lowStockLevel || 10 }); 
            await inventoryItem.save();
            lowStockEmailSent = await sendLowStockEmail(inventoryItem.item, inventoryItem.quantity, inventoryItem.lowStockLevel);
            return res.status(201).json({ message: 'New inventory item added', lowStockEmailSent });
        } else {
            // Cannot 'use' an item that doesn't exist
            return res.status(404).json({ message: 'Item not found in inventory' });
        }

    } catch (err) {
        console.error('❌ Error updating inventory:', err);
        res.status(500).json({ message: 'Server error while updating inventory' });
    }
});

// Get all inventory items
app.get('/inventory', async (req, res) => {
    try {
        const items = await Inventory.find().sort({ item: 1 });
        res.status(200).json(items);
    } catch (err) {
        console.error('❌ Error retrieving inventory:', err);
        res.status(500).json({ message: 'Failed to retrieve inventory' });
    }
});

// Update an inventory item by ID (allows direct editing of quantity and name)
app.put('/inventory/:id', async (req, res) => {
    try {
        const updated = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updated) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }
        // Use the updated lowStockLevel for the email check
        await sendLowStockEmail(updated.item, updated.quantity, updated.lowStockLevel); 
        res.status(200).json({ message: 'Inventory item updated successfully', updated });
    } catch (err) {
        console.error('❌ Error updating inventory item:', err);
        res.status(500).json({ message: 'Update failed for inventory item' });
    }
});

// Delete an inventory item by ID
app.delete('/inventory/:id', async (req, res) => {
    try {
        const deleted = await Inventory.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }
        res.status(200).json({ message: 'Inventory item deleted successfully' });
    } catch (err) {
        console.error('❌ Error deleting inventory item:', err);
        res.status(500).json({ message: 'Delete failed for inventory item' });
    }
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
