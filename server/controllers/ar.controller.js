const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const os = require('os');

const AR_TEMP_DIR = process.env.AR_TEMP_DIR || path.join(os.tmpdir(), 'ar_sessions');
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

/**
 * POST /api/ar/segment-live
 * Accepts a JPEG frame, sends to Python Flask service for REMBG segmentation,
 * returns the PNG URL.
 */
exports.segmentLive = async (req, res) => {
  const startTime = Date.now();

  // 1. Validate that req.file exists and req.body.session_id exists
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No frame uploaded' });
  }
  const sessionId = req.body.session_id;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'No session_id provided' });
  }

  try {
    // 2. Forward the uploaded file to the Python Flask service
    const formData = new FormData();
    formData.append('frame', fs.createReadStream(req.file.path));
    formData.append('session_id', sessionId);

    const pythonRes = await axios.post(
      `${PYTHON_SERVICE_URL}/segment`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 15000, // 15 second timeout
      }
    );

    // 3. Delete the uploaded JPEG (no longer needed)
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // 4. Return the PNG URL to the browser
    if (pythonRes.data.success) {
      const pngUrl = `/ar-temp/${sessionId}/${pythonRes.data.filename}`;
      return res.json({
        success: true,
        png_url: pngUrl,
        session_id: sessionId,
        processing_time_ms: Date.now() - startTime,
      });
    } else {
      throw new Error(pythonRes.data.message || 'Segmentation failed');
    }
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'Segmentation timeout',
        message: 'Processing took too long. Please try again.',
        retry: true,
      });
    }

    // Handle Python service unreachable — MOCK FALLBACK for demo
    if (error.code === 'ECONNREFUSED') {
      console.warn('[AR] ⚠️ Flask segmentation service not running. Using uploaded frame as mock garment.');
      try {
        // Create session directory and save the uploaded file as a mock garment PNG
        const sessionDir = path.join(AR_TEMP_DIR, sessionId);
        fs.mkdirSync(sessionDir, { recursive: true });

        const mockFilename = `${Date.now()}.png`;
        const mockPath = path.join(sessionDir, mockFilename);

        // Copy the uploaded JPEG as-is (it'll display fine even with .png extension)
        fs.copyFileSync(req.file.path, mockPath);

        // Clean up original upload
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        const pngUrl = `/ar-temp/${sessionId}/${mockFilename}`;
        console.log(`[AR] [MOCK] Serving mock garment at: ${pngUrl}`);
        return res.json({
          success: true,
          png_url: pngUrl,
          session_id: sessionId,
          processing_time_ms: Date.now() - startTime,
          mock: true,
        });
      } catch (mockErr) {
        console.error('[AR] Mock fallback failed:', mockErr);
        return res.status(503).json({
          success: false,
          error: 'Segmentation service unavailable',
          message: 'Python segmentation service is not running. Start it with: python segment_service.py',
          retry: true,
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Segmentation failed',
      message: error.message || 'Could not isolate garment from background. Ask seller to improve positioning.',
      retry: true,
    });
  }
};

/**
 * DELETE /api/ar/sessions/:sessionId
 * Cleans up all files for a given session.
 */
exports.deleteSession = async (req, res) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(AR_TEMP_DIR, sessionId);

  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    return res.json({ deleted: true, session_id: sessionId });
  } catch (error) {
    return res.status(500).json({
      deleted: false,
      error: error.message,
    });
  }
};

/**
 * GET /api/ar/sessions/:sessionId/status
 * Returns the processing status for a session.
 */
exports.getSessionStatus = async (req, res) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(AR_TEMP_DIR, sessionId);

  if (!fs.existsSync(sessionDir)) {
    return res.json({ status: 'not_found' });
  }

  // Check if any PNG exists in the session directory
  const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.png'));

  if (files.length > 0) {
    const latestPng = files[files.length - 1];
    return res.json({
      status: 'ready',
      png_url: `/ar-temp/${sessionId}/${latestPng}`,
    });
  }

  return res.json({ status: 'processing' });
};
