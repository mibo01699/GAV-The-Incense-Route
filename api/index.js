const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const PI_API_KEY = process.env.PI_API_KEY || '';

// ============================================
// Middleware
// ============================================
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// ============================================
// API Routes
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    service: 'gav-the-incense-route',
    status: 'ONLINE',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    pi: {
      authentication: PI_API_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
      payments: PI_API_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED'
    }
  });
});

app.get('/api/pricing-poll', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Pricing poll simulation',
      pollId: 'poll_' + Date.now(),
      timestamp: new Date().toISOString()
    }
  });
});

app.post('/api/pos/verify-voucher', (req, res) => {
  const { voucherCode } = req.body;
  if (!voucherCode) {
    return res.status(400).json({ error: 'voucherCode is required' });
  }
  res.json({
    success: true,
    data: {
      voucherCode,
      status: 'VERIFIED',
      message: 'Voucher is valid',
      timestamp: new Date().toISOString()
    }
  });
});

app.post('/api/pos/redeem-voucher', (req, res) => {
  const { voucherCode, userId } = req.body;
  if (!voucherCode || !userId) {
    return res.status(400).json({ error: 'voucherCode and userId are required' });
  }
  res.json({
    success: true,
    data: {
      voucherCode,
      userId,
      status: 'REDEEMED',
      message: 'Voucher redeemed successfully',
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/api/localization', (req, res) => {
  res.json({
    success: true,
    data: {
      languages: ['ar', 'en'],
      defaultLanguage: 'ar',
      message: 'Localization data'
    }
  });
});

// ============================================
// Static File Serving
// ============================================
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 Handler
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// Start server
if (require.main === module) {
  app.listen(PORT, () => console.log(`✅ GAV running on port ${PORT} (${NODE_ENV})`));
}

module.exports = app;