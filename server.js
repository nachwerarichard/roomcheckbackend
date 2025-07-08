const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Checklist = mongoose.model('Checklist', new mongoose.Schema({
  room: String,
  date: String,
  items: Object,
}));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post('/submit-checklist', async (req, res) => {
  const { room, date, items } = req.body;
  const missingItems = Object.entries(items).filter(([_, v]) => v === 'no');
  const checklist = new Checklist({ room, date, items });

  await checklist.save();

  if (missingItems.length > 0) {
    const itemList = missingItems.map(([k]) => `- ${k}`).join('\n');

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.TO_NOTIFY,
      subject: `Room ${room} Missing Items - ${date}`,
      text: `Missing items in Room ${room}:\n\n${itemList}`,
    });
  }

  res.json({ message: 'Checklist submitted successfully.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
