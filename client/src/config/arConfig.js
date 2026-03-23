/**
 * AR Configuration Constants
 * All thresholds and tunables in one place.
 * Shared across all tracks. Do NOT hardcode these values elsewhere.
 */

export const AR_CONFIG = {
  // --- Frame Capture (Track A) ---
  CAPTURE_INTERVAL_MS: 500,          // How often to sample seller video (ms)
  SHARPNESS_THRESHOLD: 12,           // Mean pixel delta — higher = sharper
  MIN_LUMINANCE: 80,                 // 0–255 scale, below = too dark
  MAX_LUMINANCE: 220,                // 0–255 scale, above = too bright
  STABILITY_DURATION_MS: 3000,       // How long conditions must hold before capture
  STABILITY_THRESHOLD: 8.0,          // Max mean pixel diff for "stable" (0–255 scale)
  JPEG_QUALITY: 0.85,                // canvas.toBlob quality

  // --- Buyer Pose Detection (Track B) ---
  MEDIAPIPE_MODEL_COMPLEXITY: 1,     // 0=lite, 1=full, 2=heavy
  MEDIAPIPE_MIN_DETECTION_CONF: 0.5,
  MEDIAPIPE_MIN_TRACKING_CONF: 0.5,
  EMA_ALPHA: 0.6,                    // Smoothing factor for keypoints (0–1)
  MIN_KEYPOINT_VISIBILITY: 0.5,      // Minimum visibility for shoulder/hip keypoints
  GARMENT_SHOULDER_PADDING: 1.15,    // 15% padding beyond shoulders
  GARMENT_X_OVERHANG: 0.075,         // Slight left overhang ratio
  GARMENT_Y_NECKLINE: 0.08,          // Neckline offset ratio

  // --- Buyer Distance Rules (Track B/C) ---
  BUYER_TOO_CLOSE_THRESHOLD: 0.45,   // Shoulder width > 45% of frame = too close
  BUYER_TOO_FAR_THRESHOLD: 0.15,     // Shoulder width < 15% of frame = too far

  // --- Size Estimation (Track B) ---
  ASSUMED_SHOULDER_CM: 38,           // Average Indian adult shoulder width
  FIT_TOLERANCE_CM: 3,              // ±3cm = standard fit

  // --- Session (Track C) ---
  SESSION_STATES: {
    IDLE: 'IDLE',
    SELLER_PREPARING: 'SELLER_PREPARING',
    SCANNING: 'SCANNING',
    COUNTING_DOWN: 'COUNTING_DOWN',
    PROCESSING: 'PROCESSING',
    AR_ACTIVE: 'AR_ACTIVE',
    ERROR: 'ERROR',
  },

  // --- Backend (Track D) ---
  API_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  SEGMENT_ENDPOINT: '/api/ar/segment-live',
  SESSION_DELETE_ENDPOINT: '/api/ar/sessions',
  SESSION_STATUS_ENDPOINT: '/api/ar/sessions',
  STATUS_POLL_INTERVAL_MS: 500,

  // --- Agora ---
  AGORA_APP_ID: import.meta.env.VITE_AGORA_APP_ID || '',
};

export default AR_CONFIG;
