const mongoose = require('mongoose');

const checklistSchema = new mongoose.Schema({
  room: String,
  date: String,
  items: Object,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Checklist', checklistSchema);
