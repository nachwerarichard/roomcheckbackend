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

// NEW: Inventory Schema and Model
const inventorySchema = new mongoose.Schema({
  item: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, required: true, min: 1, default: 10 },
}, { timestamps: true });

const Inventory = mongoose.model('Inventory', inventorySchema);

// NEW: AuditLog Schema and Model
const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true, default: Date.now },
  user: { type: String, required: true }, // The user who performed the action
  action: { type: String, required: true }, // e.g., 'LOGIN', 'LOGOUT', 'CREATE_CHECKLIST'
  details: { type: Object, required: false }, // Additional details about the action
  status: { type: String, required: true }, // 'SUCCESS' or 'FAILURE'
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// --- Reusable Logging Function ---
/**
 * Creates a new audit log entry.
 * @param {string} user - The user performing the action.
 * @param {string} action - The type of action (e.g., 'LOGIN', 'CREATE_INVENTORY').
 * @param {string} status - The status of the action ('SUCCESS' or 'FAILURE').
 * @param {object} details - Optional details about the action.
 */
async function createAuditLog(user, action, status, details = {}) {
  try {
    const log = new AuditLog({ user, action, status, details });
    await log.save();
    console.log(`📝 Audit Log: ${user} | ${action} | ${status}`);
  } catch (err) {
    console.error('❌ Failed to create audit log:', err);
  }
}

// --- Admin Login & Logout ---
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const action = 'LOGIN';

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    await createAuditLog(username, action, 'SUCCESS', { message: 'Successful login' });
    return res.status(200).json({ message: 'Login successful' });
  }

  await createAuditLog(username, action, 'FAILURE', { message: 'Invalid credentials' });
  return res.status(401).json({ message: 'Invalid credentials' });
});

app.post('/logout', async (req, res) => {
  const { username } = req.body;
  await createAuditLog(username, 'LOGOUT', 'SUCCESS', { message: 'Successful logout' });
  res.status(200).json({ message: 'Logout successful' });
});

// --- Email Transporter (for missing items) ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- API Endpoints for Room Checklists ---
app.post('/submit-checklist', async (req, res) => {
  const { room, date, items, user } = req.body;
  const action = 'CREATE_CHECKLIST';

  if (!room || !date || !items) {
    await createAuditLog(user, action, 'FAILURE', { message: 'Missing fields' });
    return res.status(400).json({ message: 'Missing fields' });
  }

  const checklist = new Checklist({ room, date, items });
  let emailSent = false;

  try {
    await checklist.save();
    await createAuditLog(user, action, 'SUCCESS', { room, date });

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
    await createAuditLog(user, action, 'FAILURE', { error: err.message, room, date });
    console.error('❌ Error saving checklist:', err);
    res.status(500).json({ message: 'Server error while submitting checklist' });
  }
});

app.get('/checklists', async (req, res) => {
  try {
    const data = await Checklist.find().sort({ date: -1, createdAt: -1 });
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Error retrieving checklists:', err);
    res.status(500).json({ message: 'Failed to retrieve checklists' });
  }
});

app.put('/checklists/:id', async (req, res) => {
  const { user } = req.body;
  const action = 'UPDATE_CHECKLIST';
  try {
    const updated = await Checklist.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) {
      await createAuditLog(user, action, 'FAILURE', { message: 'Checklist not found', checklistId: req.params.id });
      return res.status(404).json({ message: 'Checklist not found' });
    }
    await createAuditLog(user, action, 'SUCCESS', { checklistId: req.params.id, updatedFields: Object.keys(req.body) });
    res.status(200).json({ message: 'Checklist updated successfully', updated });
  } catch (err) {
    await createAuditLog(user, action, 'FAILURE', { error: err.message, checklistId: req.params.id });
    console.error('❌ Error updating checklist:', err);
    res.status(500).json({ message: 'Update failed for checklist' });
  }
});

app.delete('/checklists/:id', async (req, res) => {
  const { user } = req.body;
  const action = 'DELETE_CHECKLIST';
  try {
    const result = await Checklist.findByIdAndDelete(req.params.id);
    if (!result) {
      await createAuditLog(user, action, 'FAILURE', { message: 'Checklist not found', checklistId: req.params.id });
      return res.status(404).json({ message: 'Checklist not found' });
    }
    await createAuditLog(user, action, 'SUCCESS', { checklistId: req.params.id });
    res.status(200).json({ message: 'Checklist deleted successfully' });
  } catch (err) {
    await createAuditLog(user, action, 'FAILURE', { error: err.message, checklistId: req.params.id });
    console.error('❌ Error deleting checklist:', err);
    res.status(500).json({ message: 'Delete failed for checklist' });
  }
});

// --- API Endpoints for Housekeeping Room Status Reports ---
app.post('/submit-status-report', async (req, res) => {
  const { room, category, status, remarks, dateTime, user } = req.body;
  const action = 'CREATE_STATUS_REPORT';

  if (!room || !category || !status || !dateTime) {
    await createAuditLog(user, action, 'FAILURE', { message: 'Missing fields' });
    return res.status(400).json({ message: 'Missing required fields for status report' });
  }

  try {
    const newReport = new StatusReport({ room, category, status, remarks, dateTime });
    await newReport.save();
    await createAuditLog(user, action, 'SUCCESS', { room, category, status });
    res.status(201).json({ message: 'Status report submitted successfully', report: newReport });
  } catch (err) {
    await createAuditLog(user, action, 'FAILURE', { error: err.message, room });
    console.error('❌ Error saving status report:', err);
    res.status(500).json({ message: 'Server error while saving status report' });
  }
});

app.get('/status-reports', async (req, res) => {
  try {
    const reports = await StatusReport.find().sort({ dateTime: -1 });
    res.status(200).json(reports);
  } catch (err) {
    console.error('❌ Error retrieving status reports:', err);
    res.status(500).json({ message: 'Failed to retrieve status reports' });
  }
});

app.put('/status-reports/:id', async (req, res) => {
  const { user } = req.body;
  const action = 'UPDATE_STATUS_REPORT';
  try {
    const updated = await StatusReport.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) {
      await createAuditLog(user, action, 'FAILURE', { message: 'Report not found', reportId: req.params.id });
      return res.status(404).json({ message: 'Status report not found' });
    }
    await createAuditLog(user, action, 'SUCCESS', { reportId: req.params.id, updatedFields: Object.keys(req.body) });
    res.status(200).json({ message: 'Status report updated successfully', updated });
  } catch (err) {
    await createAuditLog(user, action, 'FAILURE', { error: err.message, reportId: req.params.id });
    console.error('❌ Error updating status report:', err);
    res.status(500).json({ message: 'Update failed for status report' });
  }
});

app.delete('/status-reports/:id', async (req, res) => {
  const { user } = req.body;
  const action = 'DELETE_STATUS_REPORT';
  try {
    const deleted = await StatusReport.findByIdAndDelete(req.params.id);
    if (!deleted) {
      await createAuditLog(user, action, 'FAILURE', { message: 'Report not found', reportId: req.params.id });
      return res.status(404).json({ message: 'Status report not found' });
    }
    await createAuditLog(user, action, 'SUCCESS', { reportId: req.params.id });
    res.status(200).json({ message: 'Status report deleted successfully' });
  } catch (err) {
    await createAuditLog(user, action, 'FAILURE', { error: err.message, reportId: req.params.id });
    console.error('❌ Error deleting status report:', err);
    res.status(500).json({ message: 'Delete failed for status report' });
  }
});

// --- API Endpoints for Inventory Management ---
app.post('/inventory', async (req, res) => {
  const { item, quantity, lowStockThreshold, user } = req.body;
  const action = 'CREATE_INVENTORY_ITEM';
  if (!item || quantity === undefined || lowStockThreshold === undefined) {
    await createAuditLog(user, action, 'FAILURE', { message: 'Missing fields' });
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const newItem = new Inventory({ item, quantity, lowStockThreshold });
    await newItem.save();
    await createAuditLog(user, action, 'SUCCESS', { item, quantity });
    res.status(201).json({ message: 'Inventory item added successfully', item: newItem });
  } catch (err) {
    await createAuditLog(user, action, 'FAILURE', { error: err.message, item });
    console.error('❌ Error adding inventory item:', err);
    res.status(500).json({ message: 'Server error while adding inventory item' });
  }
});

app.get('/inventory', async (req, res) => {
  try {
    const items = await Inventory.find();
    res.status(200).json(items);
  } catch (err) {
    console.error('❌ Error retrieving inventory:', err);
    res.status(500).json({ message: 'Failed to retrieve inventory' });
  }
});

app.put('/inventory/:id', async (req, res) => {
  const { quantity, user } = req.body;
  const action = 'UPDATE_INVENTORY_ITEM';
  try {
    if (quantity === undefined) {
      await createAuditLog(user, action, 'FAILURE', { message: 'Missing quantity field', itemId: req.params.id });
      return res.status(400).json({ message: 'Missing quantity field' });
    }
    const updatedItem = await Inventory.findByIdAndUpdate(
      req.params.id,
      { $inc: { quantity: -quantity } }, // Decrement quantity for usage
      { new: true, runValidators: true }
    );
    if (!updatedItem) {
      await createAuditLog(user, action, 'FAILURE', { message: 'Item not found', itemId: req.params.id });
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    await createAuditLog(user, action, 'SUCCESS', { itemId: req.params.id, usedQuantity: quantity, newQuantity: updatedItem.quantity });
    
    // Check for low stock and send email notification
    if (updatedItem.quantity < updatedItem.lowStockThreshold) {
      const html = `<p>Alert: The stock for <strong>${updatedItem.item}</strong> is low. Current quantity is <strong>${updatedItem.quantity}</strong>, which is below the threshold of ${updatedItem.lowStockThreshold}.</p>`;
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `Low Stock Alert: ${updatedItem.item}`,
          html,
        });
        console.log('📧 Low stock email alert sent.');
      } catch (emailErr) {
        console.error('❌ Low stock email sending failed:', emailErr);
      }
    }

    res.status(200).json({ message: 'Inventory updated successfully', item: updatedItem });
  } catch (err) {
    await createAuditLog(user, action, 'FAILURE', { error: err.message, itemId: req.params.id });
    console.error('❌ Error updating inventory:', err);
    res.status(500).json({ message: 'Update failed for inventory item' });
  }
});

app.delete('/inventory/:id', async (req, res) => {
  const { user } = req.body;
  const action = 'DELETE_INVENTORY_ITEM';
  try {
    const result = await Inventory.findByIdAndDelete(req.params.id);
    if (!result) {
      await createAuditLog(user, action, 'FAILURE', { message: 'Item not found', itemId: req.params.id });
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    await createAuditLog(user, action, 'SUCCESS', { itemId: req.params.id });
    res.status(200).json({ message: 'Inventory item deleted successfully' });
  } catch (err) {
    await createAuditLog(user, action, 'FAILURE', { error: err.message, itemId: req.params.id });
    console.error('❌ Error deleting inventory item:', err);
    res.status(500).json({ message: 'Delete failed for inventory item' });
  }
});

// NEW: API Endpoint for Audit Logs
// The frontend can now POST to this endpoint to create a new log entry.
// This route will call the reusable createAuditLog function.
app.post('/audit-logs', async (req, res) => {
  const { user, action, details, status } = req.body;
  
  if (!user || !action || !status) {
    return res.status(400).json({ message: 'Missing required fields for audit log' });
  }

  try {
    await createAuditLog(user, action, status, details);
    res.status(201).json({ message: 'Audit log created successfully' });
  } catch (err) {
    console.error('❌ Error creating audit log via API:', err);
    res.status(500).json({ message: 'Server error while creating audit log' });
  }
});


app.get('/audit-logs', async (req, res) => {
  try {
    // Sort by timestamp in descending order to show latest logs first
    const logs = await AuditLog.find().sort({ timestamp: -1 });
    res.status(200).json(logs);
  } catch (err) {
    console.error('❌ Error retrieving audit logs:', err);
    res.status(500).json({ message: 'Failed to retrieve audit logs' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

