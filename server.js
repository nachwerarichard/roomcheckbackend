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

// Inventory Schema and Model with custom lowStockLevel
// ⭐ FIX: Removed 'unique: true' from 'item' to fix the E11000 duplicate key error
const inventorySchema = new mongoose.Schema({
  item: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  lowStockLevel: { type: Number, required: true, min: 0, default: 0 }
}, { timestamps: true });

const Inventory = mongoose.model('Inventory', inventorySchema);

const transactionSchema = new mongoose.Schema({
  item: { type: String, required: true },
  quantity: { type: Number, required: true },
  action: { type: String, required: true, enum: ['add', 'use'] },
  timestamp: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// 🆕 NEW: Audit Log Schema and Model for secure logging of events
const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  details: { type: Object, required: true },
  timestamp: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// --- Secure Logging Function ---
/**
 * Creates and saves a new audit log entry.
 * @param {string} action - A brief description of the action (e.g., 'Checklist Submitted').
 * @param {object} details - An object containing non-sensitive details about the action.
 */
async function createAuditLog(action, details) {
  try {
    const log = new AuditLog({ action, details });
    await log.save();
    console.log(`📝 Audit Log: ${action} -`, details);
  } catch (err) {
    console.error('❌ Failed to create audit log:', err);
  }
}

// --- Admin Login ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // 💡 Audit log for successful login attempt
    createAuditLog('Login Successful', { username });
    return res.status(200).json({ message: 'Login successful' });
  }

  // 💡 Audit log for failed login attempt
  createAuditLog('Login Failed', { username, message: 'Invalid credentials' });
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
    // 💡 Audit log for new checklist submission
    createAuditLog('Checklist Submitted', { room, date });

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
    // 💡 Audit log for checklist update
    createAuditLog('Checklist Updated', { id: updated._id, room: updated.room });
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
    // 💡 Audit log for checklist deletion
    createAuditLog('Checklist Deleted', { id: req.params.id });
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
    // 💡 Audit log for new status report submission
    createAuditLog('Status Report Submitted', { room, category, status });
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
    // 💡 Audit log for status report update
    createAuditLog('Status Report Updated', { id: updated._id, room: updated.room });
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
    // 💡 Audit log for status report deletion
    createAuditLog('Status Report Deleted', { id: req.params.id });
    res.status(200).json({ message: 'Status report deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting status report:', err);
    res.status(500).json({ message: 'Delete failed for status report' });
  }
});

// This is your new backend route for fetching an inventory snapshot
app.get('/inventory/snapshot/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const startOfDay = new Date(date);

    if (isNaN(startOfDay.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // ⭐ FIX: Set the snapshot date to the end of the day in UTC ⭐
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Step 1: Calculate the total quantity for each item up to the snapshot date
    const snapshotQuantities = await Transaction.aggregate([
      {
        $match: {
          timestamp: { $lte: endOfDay } // Use endOfDay for the filter
        }
      },
      {
        $group: {
          _id: '$item',
          totalQuantity: {
            $sum: {
              $cond: [
                { $eq: ['$action', 'add'] },
                '$quantity',
                { $multiply: ['$quantity', -1] }
              ]
            }
          }
        }
      } // <-- This brace was missing and has been added to fix the syntax error
    ]);

    const inventoryItems = await Inventory.find({ item: { $in: snapshotQuantities.map(s => s._id) } });

    // Step 3: Combine the quantity and lowStockLevel data
    const combinedSnapshot = snapshotQuantities.map(snapshotItem => {
      const inventoryItem = inventoryItems.find(i => i.item === snapshotItem._id);
      return {
        item: snapshotItem._id,
        quantity: snapshotItem.totalQuantity,
        lowStockLevel: inventoryItem ? inventoryItem.lowStockLevel : 0 // Use the value from Inventory or default to 0
      };
    });

    // 💡 Audit log for fetching an inventory snapshot
    createAuditLog('Inventory Snapshot Fetched', { date: date });

    res.status(200).json(combinedSnapshot);

  } catch (err) {
    console.error('❌ Error fetching inventory snapshot:', err);
    res.status(500).json({ message: 'Server error while fetching snapshot' });
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
    
    // Step 1: Check if item exists and update its current quantity
    if (inventoryItem) {
      if (action === 'add') {
        inventoryItem.quantity += quantity;
      } else if (action === 'use') {
        if (inventoryItem.quantity < quantity) {
          return res.status(400).json({ message: `Cannot use ${quantity} units. Only ${inventoryItem.quantity} are in stock.` });
        }
        inventoryItem.quantity -= quantity;
      }
      
      if (lowStockLevel !== undefined && lowStockLevel !== null) {
        inventoryItem.lowStockLevel = lowStockLevel;
      }
      
      await inventoryItem.save();
    } else if (action === 'add') {
      const newLowStockLevel = lowStockLevel !== undefined && lowStockLevel !== null ? Number(lowStockLevel) : 10;
      inventoryItem = new Inventory({ item, quantity, lowStockLevel: newLowStockLevel });
      await inventoryItem.save();
    } else {
      return res.status(404).json({ message: 'Item not found in inventory' });
    }

    // ⭐ Step 2: Create a new Transaction record for this movement ⭐
    const newTransaction = new Transaction({
      item: inventoryItem.item,
      quantity: quantity,
      action: action,
      timestamp: new Date()
    });
    await newTransaction.save();

    // 💡 Audit log for inventory transaction
    createAuditLog('Inventory Transaction', { item: inventoryItem.item, quantity, action });

    lowStockEmailSent = await sendLowStockEmail(inventoryItem.item, inventoryItem.quantity, inventoryItem.lowStockLevel);
    return res.status(200).json({ message: 'Inventory updated successfully', lowStockEmailSent });

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
    // 💡 Audit log for inventory item update
    createAuditLog('Inventory Item Updated', { id: updated._id, item: updated.item });
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
    // 💡 Audit log for inventory item deletion
    createAuditLog('Inventory Item Deleted', { id: req.params.id });
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
