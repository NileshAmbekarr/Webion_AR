const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const AR_TEMP_DIR = process.env.AR_TEMP_DIR || path.join(os.tmpdir(), 'ar_sessions');
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

/**
 * POST /api/ar/segment-live
 * Accepts a JPEG frame, sends to Python Flask service for REMBG segmentation,
 * returns the PNG URL.
 */
exports.segmentLive = async (req, res) => {
  // --- STUB: Agent 3 (Track D) will implement the full logic ---
  // This shell shows the expected flow. Replace with real implementation.
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Track D: Implement segmentLive controller'
  });
};

/**
 * DELETE /api/ar/sessions/:sessionId
 * Cleans up all files for a given session.
 */
exports.deleteSession = async (req, res) => {
  // --- STUB: Agent 3 (Track D) will implement ---
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Track D: Implement deleteSession controller'
  });
};

/**
 * GET /api/ar/sessions/:sessionId/status
 * Returns the processing status for a session.
 */
exports.getSessionStatus = async (req, res) => {
  // --- STUB: Agent 3 (Track D) will implement ---
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Track D: Implement getSessionStatus controller'
  });
};
