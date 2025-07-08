require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const Checklist = require('./checklist');

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
app.use(cors());
app.use(express.json());
// Add this to store credentials securely (in memory or DB; for demo, using plain values)


app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.status(200).json({ message: 'Login successful' });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Submit checklist
app.post('/submit-checklist', async (req, res) => {
  const { room, date, items } = req.body;

  if (!room || !date || !items) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const checklist = new Checklist({ room, date, items });

  try {
    await checklist.save();

    // Check for missing items
    const missingItems = Object.entries(items).filter(([, val]) => val === 'no');
    if (missingItems.length > 0) {
      const html = `<p>Room <strong>${room}</strong> on <strong>${date}</strong> is missing:</p>
        <ul>${missingItems.map(([key]) => `<li>${key}</li>`).join('')}</ul>`;

      try {
        const result = await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `Missing Items - Room ${room}`,
          html,
        });
        console.log('📧 Email sent:', result.response);
      } catch (emailErr) {
        console.error('❌ Email sending failed:', emailErr);
        return res.status(500).json({ message: 'Email sending failed', error: emailErr.message });
      }
    }

    res.status(201).json({ message: 'Submitted', checklist });

  } catch (err) {
    console.error('❌ Error saving checklist:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ✅ Get all checklists
app.get('/checklists', async (req, res) => {
  try {
    const data = await Checklist.find().sort({ timestamp: -1 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve checklists' });
  }
});

// ✅ Get one checklist by ID
app.get('/checklists/:id', async (req, res) => {
  try {
    const data = await Checklist.findById(req.params.id);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json(data);
  } catch {
    res.status(500).json({ message: 'Failed to fetch checklist' });
  }
});

// ✅ Update checklist by ID
app.put('/checklists/:id', async (req, res) => {
  try {
    const updated = await Checklist.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Updated', updated });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// ✅ Delete checklist
app.delete('/checklists/:id', async (req, res) => {
  try {
    const result = await Checklist.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Checklist not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

// PUT endpoint to update a checklist by ID
app.put('/checklists/:id', (req, res) => {
  const checklistId = parseInt(req.params.id);
  const { room, date, items } = req.body;

  const index = checklists.findIndex(entry => entry.id === checklistId);
  if (index === -1) {
    return res.status(404).json({ message: 'Checklist not found' });
  }

  checklists[index] = { ...checklists[index], room, date, items };
  res.status(200).json({ message: 'Checklist updated successfully', checklist: checklists[index] });
});


app.delete('/checklists/:id', async (req, res) => {
  try {
    const deleted = await Checklist.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Checklist not found' });
    }
    res.status(200).json({ message: 'Checklist deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete', error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
