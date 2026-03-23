const express = require('express');
const router = express.Router();
const arController = require('../controllers/ar.controller');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');

// --- Multer config for frame uploads ---
const framesDir = process.env.AR_FRAMES_DIR || path.join(os.tmpdir(), 'ar_frames');
fs.mkdirSync(framesDir, { recursive: true });

const upload = multer({
  dest: framesDir,
  limits: {
    fileSize: (parseInt(process.env.AR_MAX_UPLOAD_SIZE_MB) || 2) * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_MEDIA_TYPE'), false);
    }
  }
});

// POST /api/ar/segment-live — Accept JPEG frame, return segmented PNG URL
router.post('/segment-live', upload.single('frame'), arController.segmentLive);

// DELETE /api/ar/sessions/:sessionId — Clean up session files
router.delete('/sessions/:sessionId', arController.deleteSession);

// GET /api/ar/sessions/:sessionId/status — Poll segmentation status
router.get('/sessions/:sessionId/status', arController.getSessionStatus);

// --- Multer error handling ---
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: 'File too large', message: 'Maximum upload size is 2MB.' });
    }
  }
  if (err.message === 'UNSUPPORTED_MEDIA_TYPE') {
    return res.status(415).json({ success: false, error: 'Unsupported media type', message: 'Only JPEG and PNG images are accepted.' });
  }
  next(err);
});

module.exports = router;
