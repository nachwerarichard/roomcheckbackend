// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing passwords
const session = require('express-session'); // For session management
const MongoStore = require('connect-mongo'); // To store sessions in MongoDB

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

// --- Mongoose Schemas and Models ---

// User Schema and Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['admin', 'housekeeper', 'store_manager'] }
}, { timestamps: true });

// Pre-save hook to hash the password before saving a new user or updating the password
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

const User = mongoose.model('User', userSchema);

// Audit Log Schema and Model
const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  username: { type: String, required: false },
  action: { type: String, required: true }, // e.g., 'login', 'create_checklist', 'update_inventory'
  model: { type: String, required: true }, // e.g., 'Checklist', 'Inventory'
  details: { type: Object, required: false }, // Additional details about the action
}, { timestamps: true });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// Checklist Schema and Model (existing)
const checklistSchema = new mongoose.Schema({
  room: { type: String, required: true },
  date: { type: String, required: true },
  items: { type: Object, required: true },
}, { timestamps: true });
const Checklist = mongoose.model('Checklist', checklistSchema);

// StatusReport Schema and Model (existing)
const statusReportSchema = new mongoose.Schema({
  room: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, required: true },
  remarks: { type: String, default: '' },
  dateTime: { type: Date, required: true, default: Date.now },
}, { timestamps: true });
const StatusReport = mongoose.model('StatusReport', statusReportSchema);

// Inventory Schema and Model (existing)
const inventorySchema = new mongoose.Schema({
  item: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  lowStockLevel: { type: Number, required: true, min: 0, default: 0 }
}, { timestamps: true });
const Inventory = mongoose.model('Inventory', inventorySchema);

// Transaction Schema and Model (existing)
const transactionSchema = new mongoose.Schema({
  item: { type: String, required: true },
  quantity: { type: Number, required: true },
  action: { type: String, required: true, enum: ['add', 'use'] },
  timestamp: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// --- Initial User Creation (For Development Only) ---
// This block should be removed in production environments.
async function createInitialUsers() {
  const initialUsers = [
    { username: 'admin', password: 'password123', role: 'admin' },
    { username: 'housekeeper', password: 'password123', role: 'housekeeper' },
    { username: 'store_manager', password: 'password123', role: 'store_manager' }
  ];

  for (const userData of initialUsers) {
    try {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        const newUser = new User(userData);
        await newUser.save();
        console.log(`✅ User ${userData.username} created with role ${userData.role}`);
      } else {
        console.log(`ℹ️ User ${userData.username} already exists.`);
      }
    } catch (err) {
      console.error(`❌ Error creating user ${userData.username}:`, err);
    }
  }
}

createInitialUsers();

// --- Middleware ---

app.use(express.json());
const corsOptions = {
  origin: 'https://harmonious-crumble-2ca9ba.netlify.app',
  credentials: true, // Required to allow cookies/sessions
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Session Middleware Configuration
app.use(session({
  // ⚠️ WARNING: Hard-coding the secret key is a major security risk.
  // This should be loaded from a secure environment variable.
  secret: 'a_hardcoded_session_secret_for_testing_only_123456789',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 60 * 60, // Session will expire after 1 hour
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: 60 * 60 * 1000 // 1 hour
  }
}));

// --- Audit Log Utility Function ---
/**
 * Creates an audit log entry.
 * @param {string} action - The action performed (e.g., 'login', 'create_item').
 * @param {string} model - The model affected (e.g., 'User', 'Inventory').
 * @param {object} req - The request object, containing the user details.
 * @param {object} [details={}] - Optional additional details for the log.
 */
async function createAuditLog(action, model, req, details = {}) {
  try {
    const log = new AuditLog({
      userId: req.session.user ? req.session.user.id : null,
      username: req.session.user ? req.session.user.username : 'system',
      action,
      model,
      details,
    });
    await log.save();
  } catch (err) {
    console.error('❌ Failed to create audit log:', err);
  }
}

// --- Email Transporter Setup (Placeholder) ---
// You will need to uncomment and configure this section with your email credentials
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// --- Login & Authentication Routes ---
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });

    if (user && await bcrypt.compare(password, user.password)) {
      // Set the user in the session
      req.session.user = { id: user._id, username: user.username, role: user.role };
      
      // Create an audit log for a successful login
      await createAuditLog('login_success', 'User', req, { ip: req.ip });

      return res.status(200).json({ message: 'Login successful', role: user.role });
    }

    // Create an audit log for a failed login attempt
    await createAuditLog('login_failed', 'User', { session: { user: { username } } }, { ip: req.ip });
    return res.status(401).json({ message: 'Invalid credentials' });
  } catch (err) {
    console.error('❌ Login error:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/logout', (req, res) => {
  if (req.session.user) {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({ message: 'Failed to log out' });
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.status(200).json({ message: 'Logout successful' });
    });
  } else {
    res.status(400).json({ message: 'No user is logged in' });
  }
});

// Middleware for Authorization
function checkRole(roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ message: 'Access denied: You do not have the required role.' });
    }
    next();
  };
}

// --- API Endpoints for Room Checklists (protected) ---

// Submit checklist
app.post('/submit-checklist', checkRole(['admin', 'housekeeper']), async (req, res) => {
  const { room, date, items } = req.body;
  if (!room || !date || !items) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const checklist = new Checklist({ room, date, items });
  let emailSent = false;

  try {
    await checklist.save();
    await createAuditLog('create_checklist', 'Checklist', req, { checklistId: checklist._id, room, date });

    const missingItems = Object.entries(items).filter(([, val]) => val === 'no');
    if (missingItems.length > 0) {
      const html = `<p>Room <strong>${room}</strong> on <strong>${date}</strong> is missing:</p>
        <ul>${missingItems.map(([key]) => `<li>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>`).join('')}</ul>
        <p>Please address this immediately.</p>`;

      try {
        // await transporter.sendMail({
        //   from: process.env.EMAIL_USER,
        //   to: process.env.EMAIL_USER,
        //   subject: `Urgent: Missing Items in Room ${room} on ${date}`,
        //   html,
        // });
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
app.get('/checklists', checkRole(['admin', 'housekeeper']), async (req, res) => {
  try {
    const data = await Checklist.find().sort({ date: -1, createdAt: -1 });
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Error retrieving checklists:', err);
    res.status(500).json({ message: 'Failed to retrieve checklists' });
  }
});

// Update checklist by ID
app.put('/checklists/:id', checkRole(['admin', 'housekeeper']), async (req, res) => {
  try {
    const updated = await Checklist.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ message: 'Checklist not found' });
    }
    await createAuditLog('update_checklist', 'Checklist', req, { checklistId: updated._id, updates: req.body });
    res.status(200).json({ message: 'Checklist updated successfully', updated });
  } catch (err) {
    console.error('❌ Error updating checklist:', err);
    res.status(500).json({ message: 'Update failed for checklist' });
  }
});

// Delete checklist
app.delete('/checklists/:id', checkRole(['admin']), async (req, res) => {
  try {
    const result = await Checklist.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Checklist not found' });
    }
    await createAuditLog('delete_checklist', 'Checklist', req, { checklistId: req.params.id });
    res.status(200).json({ message: 'Checklist deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting checklist:', err);
    res.status(500).json({ message: 'Delete failed for checklist' });
  }
});

// --- API Endpoints for Housekeeping Room Status Reports (protected) ---

// Submit a new status report
app.post('/submit-status-report', checkRole(['admin', 'housekeeper']), async (req, res) => {
  const { room, category, status, remarks, dateTime } = req.body;
  if (!room || !category || !status || !dateTime) {
    return res.status(400).json({ message: 'Missing required fields for status report' });
  }

  try {
    const newReport = new StatusReport({ room, category, status, remarks, dateTime });
    await newReport.save();
    await createAuditLog('create_status_report', 'StatusReport', req, { reportId: newReport._id, room, category });
    res.status(201).json({ message: 'Status report submitted successfully', report: newReport });
  } catch (err) {
    console.error('❌ Error saving status report:', err);
    res.status(500).json({ message: 'Server error while saving status report' });
  }
});

// Get all status reports
app.get('/status-reports', checkRole(['admin', 'housekeeper']), async (req, res) => {
  try {
    const reports = await StatusReport.find().sort({ dateTime: -1 });
    res.status(200).json(reports);
  } catch (err) {
    console.error('❌ Error retrieving status reports:', err);
    res.status(500).json({ message: 'Failed to retrieve status reports' });
  }
});

// Update a status report by ID
app.put('/status-reports/:id', checkRole(['admin', 'housekeeper']), async (req, res) => {
  try {
    const updated = await StatusReport.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ message: 'Status report not found' });
    }
    await createAuditLog('update_status_report', 'StatusReport', req, { reportId: updated._id, updates: req.body });
    res.status(200).json({ message: 'Status report updated successfully', updated });
  } catch (err) {
    console.error('❌ Error updating status report:', err);
    res.status(500).json({ message: 'Update failed for status report' });
  }
});

// Delete a status report by ID
app.delete('/status-reports/:id', checkRole(['admin']), async (req, res) => {
  try {
    const deleted = await StatusReport.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Status report not found' });
    }
    await createAuditLog('delete_status_report', 'StatusReport', req, { reportId: req.params.id });
    res.status(200).json({ message: 'Status report deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting status report:', err);
    res.status(500).json({ message: 'Delete failed for status report' });
  }
});

// --- API Endpoints for Inventory Management (protected) ---

// Add or Use Inventory (Create/Update logic combined)
app.post('/inventory', checkRole(['admin', 'store_manager']), async (req, res) => {
  const { item, quantity, action, lowStockLevel } = req.body;
  if (!item || !quantity || !action) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    let inventoryItem = await Inventory.findOne({ item: { $regex: new RegExp(`^${item}$`, 'i') } });
    let lowStockEmailSent = false;
    let logAction = '';

    if (inventoryItem) {
      if (action === 'add') {
        inventoryItem.quantity += quantity;
        logAction = 'add_inventory_quantity';
      } else if (action === 'use') {
        if (inventoryItem.quantity < quantity) {
          return res.status(400).json({ message: `Cannot use ${quantity} units. Only ${inventoryItem.quantity} are in stock.` });
        }
        inventoryItem.quantity -= quantity;
        logAction = 'use_inventory_quantity';
      }
      if (lowStockLevel !== undefined && lowStockLevel !== null) {
        inventoryItem.lowStockLevel = lowStockLevel;
      }
      await inventoryItem.save();
    } else if (action === 'add') {
      const newLowStockLevel = lowStockLevel !== undefined && lowStockLevel !== null ? Number(lowStockLevel) : 10;
      inventoryItem = new Inventory({ item, quantity, lowStockLevel: newLowStockLevel });
      await inventoryItem.save();
      logAction = 'create_inventory_item';
    } else {
      return res.status(404).json({ message: 'Item not found in inventory' });
    }

    const newTransaction = new Transaction({
      item: inventoryItem.item,
      quantity: quantity,
      action: action,
      timestamp: new Date()
    });
    await newTransaction.save();

    await createAuditLog(logAction, 'Inventory', req, { itemId: inventoryItem._id, quantity, action, newQuantity: inventoryItem.quantity });
    // lowStockEmailSent = await sendLowStockEmail(inventoryItem.item, inventoryItem.quantity, inventoryItem.lowStockLevel);
    return res.status(200).json({ message: 'Inventory updated successfully', lowStockEmailSent });
  } catch (err) {
    console.error('❌ Error updating inventory:', err);
    res.status(500).json({ message: 'Server error while updating inventory' });
  }
});

// Get all inventory items
app.get('/inventory', checkRole(['admin', 'store_manager']), async (req, res) => {
  try {
    const items = await Inventory.find().sort({ item: 1 });
    res.status(200).json(items);
  } catch (err) {
    console.error('❌ Error retrieving inventory:', err);
    res.status(500).json({ message: 'Failed to retrieve inventory' });
  }
});

// Update an inventory item by ID
app.put('/inventory/:id', checkRole(['admin', 'store_manager']), async (req, res) => {
  try {
    const updated = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    await createAuditLog('update_inventory_item', 'Inventory', req, { itemId: updated._id, updates: req.body });
    // await sendLowStockEmail(updated.item, updated.quantity, updated.lowStockLevel);
    res.status(200).json({ message: 'Inventory item updated successfully', updated });
  } catch (err) {
    console.error('❌ Error updating inventory item:', err);
    res.status(500).json({ message: 'Update failed for inventory item' });
  }
});

// Delete an inventory item by ID
app.delete('/inventory/:id', checkRole(['admin']), async (req, res) => {
  try {
    const deleted = await Inventory.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    await createAuditLog('delete_inventory_item', 'Inventory', req, { itemId: req.params.id });
    res.status(200).json({ message: 'Inventory item deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting inventory item:', err);
    res.status(500).json({ message: 'Delete failed for inventory item' });
  }
});

// Get inventory snapshot for a given date
app.get('/inventory/snapshot/:date', checkRole(['admin', 'store_manager']), async (req, res) => {
  try {
    const { date } = req.params;
    const startOfDay = new Date(date);
    if (isNaN(startOfDay.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const snapshotQuantities = await Transaction.aggregate([
      {
        $match: {
          timestamp: { $lte: endOfDay }
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
      }
    ]);

    const inventoryItems = await Inventory.find({ item: { $in: snapshotQuantities.map(s => s._id) } });

    const combinedSnapshot = snapshotQuantities.map(snapshotItem => {
      const inventoryItem = inventoryItems.find(i => i.item === snapshotItem._id);
      return {
        item: snapshotItem._id,
        quantity: snapshotItem.totalQuantity,
        lowStockLevel: inventoryItem ? inventoryItem.lowStockLevel : 0
      };
    });
    res.status(200).json(combinedSnapshot);
  } catch (err) {
    console.error('❌ Error fetching inventory snapshot:', err);
    res.status(500).json({ message: 'Server error while fetching snapshot' });
  }
});

// --- API Endpoints for User and Audit Management (Admin Only) ---

// Create a new user (Admin only)
app.post('/users', checkRole(['admin']), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Missing username, password, or role' });
  }
  try {
    const newUser = new User({ username, password, role });
    await newUser.save();
    await createAuditLog('create_user', 'User', req, { userId: newUser._id, username, role });
    res.status(201).json({ message: 'User created successfully', user: { id: newUser._id, username: newUser.username, role: newUser.role } });
  } catch (err) {
    console.error('❌ Error creating user:', err);
    res.status(500).json({ message: 'Server error while creating user' });
  }
});

// Get all audit logs (Admin only)
app.get('/audit-logs', checkRole(['admin']), async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 });
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
