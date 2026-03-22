const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL);

const entrySchema = new mongoose.Schema({
  user:    { type: String, default: 'anonymous' },
  total:   Number,
  t:       Number,
  e:       Number,
  f:       Number,
  food:    String,
  date:    String,
  savedAt: { type: Date, default: Date.now }
});

const Entry = mongoose.model('Entry', entrySchema);

module.exports = Entry;