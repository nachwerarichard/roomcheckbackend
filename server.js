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

// Checklist Schema and Model (from your original code)
const checklistSchema = new mongoose.Schema({
  room: { type: String, required: true },
  date: { type: String, required: true }, // Storing as string as per your HTML input type="date"
  items: { type: Object, required: true }, // Object containing item: 'yes'/'no' pairs
}, { timestamps: true }); // Adds createdAt and updatedAt

const Checklist = mongoose.model('Checklist', checklistSchema);

// NEW: StatusReport Schema and Model
const statusReportSchema = new mongoose.Schema({
  room: { type: String, required: true },
  category: { type: String, required: true }, // e.g., delux1, delux2, standard
  status: { type: String, required: true },   // e.g., arrival, occupied, departure, vacant_ready, vacant_not_ready, out_of_order, out_of_service
  remarks: { type: String, default: '' },
  dateTime: { type: Date, required: true, default: Date.now }, // Date and time of the report
}, { timestamps: true }); // Adds createdAt and updatedAt

const StatusReport = mongoose.model('StatusReport', statusReportSchema);

// --- Admin Login ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.status(200).json({ message: 'Login successful' });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
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
          to: process.env.EMAIL_USER, // Sends email to self (admin)
          subject: `Urgent: Missing Items in Room ${room} on ${date}`,
          html,
        });
        console.log('📧 Email sent for missing items.');
        emailSent = true;
      } catch (emailErr) {
        console.error('❌ Email sending failed:', emailErr);
        // Do not return error, just log it, as checklist submission might still be successful
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
    const data = await Checklist.find().sort({ date: -1, createdAt: -1 }); // Sort by date, then creation time
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

// --- API Endpoints for Housekeeping Room Status Reports ---

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
    // Sort by dateTime in descending order to show latest reports first
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
