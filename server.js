const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ Add this CORS setup just below "const app = express();"
app.use(cors({
  origin: 'https://comforting-pegasus-3ff5b2.netlify.app',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// ✅ FIXED: Allow frontend requests from Netlify domain


// ✅ Middleware
app.use(bodyParser.json());
const path = require('path');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ✅ Mongoose Model
const Checklist = mongoose.model('Checklist', new mongoose.Schema({
  room: { type: String, required: true },
  date: { type: String, required: true },
  items: { type: Object, required: true },
}, { timestamps: true }));

// ✅ Email Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Submit checklist route
app.post('/submit-checklist', async (req, res) => {
  const { room, date, items } = req.body;

  if (!room || !date || !items) {
    return res.status(400).json({ message: 'Missing required fields: room, date, or items.' });
  }

  const missingItems = Object.entries(items).filter(([_, v]) => v === 'no');
  const checklist = new Checklist({ room, date, items });

  try {
    await checklist.save();

    if (missingItems.length > 0) {
      const itemList = missingItems.map(([k]) => `- ${k}`).join('\n');
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.TO_NOTIFY,
        subject: `Room ${room} Missing Items - ${date}`,
        text: `Missing items in Room ${room} on ${date}:\n\n${itemList}\n\nChecklist ID: ${checklist._id}`,
      };

      await transporter.sendMail(mailOptions);
    }

    res.status(201).json({
      message: 'Checklist submitted successfully.',
      checklistId: checklist._id,
      emailSent: missingItems.length > 0
    });
  } catch (error) {
    console.error('❌ Error submitting checklist or sending email:', error);
    res.status(500).json({ message: 'Failed to submit checklist.', error: error.message });
  }
});

// ✅ Health check route
app.get('/health', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    res.status(200).json({ status: 'OK', database: 'connected' });
  } else {
    res.status(503).json({ status: 'Service Unavailable', database: 'disconnected' });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
