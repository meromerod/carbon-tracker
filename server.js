// server.js
const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');
process.env.MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/carbon_tracker';
const Entry = require('./db');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ─────────────────────────
//  ROUTE 1: Save entry
//  Now includes user name
// ─────────────────────────
app.post('/api/save', async function(req, res) {
  try {
    const entry = new Entry({
      user:  req.body.user || 'anonymous',   // NEW
      total: req.body.total,
      t:     req.body.t,
      e:     req.body.e,
      f:     req.body.f,
      food:  req.body.food,
      date:  req.body.date
    });
    await entry.save();
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ error: 'Could not save entry' });
  }
});

// ─────────────────────────
//  ROUTE 2: Get history
//  Filtered by user
// ─────────────────────────
app.get('/api/history', async function(req, res) {
  try {
    const user = req.query.user || 'anonymous';   // NEW — ?user=Arjun
    const entries = await Entry.find({ user: user })
      .sort({ savedAt: -1 })
      .limit(30);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

// ─────────────────────────
//  ROUTE 3: Weekly average
//  Filtered by user
// ─────────────────────────
app.get('/api/weekly', async function(req, res) {
  try {
    const user = req.query.user || 'anonymous';
    const entries = await Entry.find({ user: user })
      .sort({ savedAt: -1 })
      .limit(7);

    if (!entries.length) return res.json({ avg: null, count: 0 });

    const avg = entries.reduce(function(s, e) {
      return s + e.total;
    }, 0) / entries.length;

    res.json({ avg: parseFloat(avg.toFixed(2)), count: entries.length });
  } catch (err) {
    res.status(500).json({ error: 'Could not compute weekly average' });
  }
});

// ─────────────────────────
//  ROUTE 4: Trend data     NEW
//  Last 14 entries for chart
// ─────────────────────────
app.get('/api/trend', async function(req, res) {
  try {
    const user = req.query.user || 'anonymous';
    const entries = await Entry.find({ user: user })
      .sort({ savedAt: -1 })
      .limit(14);

    // Reverse so oldest is first (left side of chart)
    const trend = entries.reverse().map(function(e) {
      return { date: e.date, total: e.total };
    });

    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch trend' });
  }
});

// ─────────────────────────
//  ROUTE 5: Delete history
//  Only this user's entries
// ─────────────────────────
app.delete('/api/history', async function(req, res) {
  try {
    const user = req.query.user || 'anonymous';
    await Entry.deleteMany({ user: user });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not clear history' });
  }
});

// ─────────────────────────
//  ROUTE 6: Send email report   NEW
// ─────────────────────────
app.post('/api/email', async function(req, res) {
  try {
    const { to, user, avg, count, latest } = req.body;

    // Nodemailer transporter — using Gmail
    // You need to enable "App Passwords" in your Google account
    // Go to: myaccount.google.com → Security → 2-Step Verification → App Passwords
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'YOUR_GMAIL@gmail.com',     // replace with your Gmail
        pass: 'YOUR_APP_PASSWORD'          // replace with your App Password (not your normal password)
      }
    });

    const mailOptions = {
      from:    'YOUR_GMAIL@gmail.com',
      to:      to,
      subject: '🌿 Your Weekly Carbon Footprint Report',
      html: `
        <div style="font-family:monospace;max-width:500px;margin:0 auto;padding:24px;background:#f5f0e8;border-radius:16px;">
          <h1 style="font-family:Georgia,serif;color:#1a2e1a;font-size:28px;margin-bottom:4px;">
            Weekly Report
          </h1>
          <p style="color:#5a7a5a;font-size:12px;margin-bottom:24px;">for ${user}</p>

          <div style="background:#1a2e1a;border-radius:12px;padding:20px;margin-bottom:16px;color:#f5f0e8;">
            <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.6;margin-bottom:4px;">7-day average</p>
            <p style="font-family:Georgia,serif;font-size:48px;font-weight:700;color:#b8e07a;line-height:1;margin:0;">${avg}</p>
            <p style="font-size:13px;opacity:0.6;margin-top:2px;">kg CO₂ / day (${count} entries)</p>
          </div>

          <div style="background:#ffffff;border-radius:12px;padding:16px;margin-bottom:16px;">
            <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#5a7a5a;margin-bottom:8px;">Latest entry</p>
            <p style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a2e1a;">${latest} kg CO₂</p>
            <p style="font-size:11px;color:#5a7a5a;">Transport + Electricity + Food</p>
          </div>

          <p style="font-size:11px;color:#5a7a5a;text-align:center;margin-top:20px;">
            Keep tracking at <strong>localhost:3000</strong> 🌱
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true });

  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, function() {
  console.log('Server running at http://localhost:' + PORT);
});