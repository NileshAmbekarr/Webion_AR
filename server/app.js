const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// --- Middleware ---
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// --- Ephemeral PNG file serving (UUID-guarded) ---
const AR_TEMP_DIR = process.env.AR_TEMP_DIR || path.join(require('os').tmpdir(), 'ar_sessions');
fs.mkdirSync(AR_TEMP_DIR, { recursive: true });

app.use('/ar-temp', (req, res, next) => {
  const uuidPattern = /^\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/;
  if (!uuidPattern.test(req.path)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, express.static(AR_TEMP_DIR, {
  maxAge: '1h',
  setHeaders: (res) => {
    res.set('Cache-Control', 'private, max-age=3600');
  }
}));

// --- Routes ---
const arRoutes = require('./routes/ar.routes');
app.use('/api/ar', arRoutes);

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'webion-ar-backend' });
});

// --- Cleanup job ---
const { startCleanupJob } = require('./scripts/cleanup');
startCleanupJob();

// --- Start server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Webion AR] Backend running on port ${PORT}`);
  console.log(`[Webion AR] AR temp dir: ${AR_TEMP_DIR}`);
});

module.exports = app;
