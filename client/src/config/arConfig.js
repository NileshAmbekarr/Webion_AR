/**
 * AR Configuration Constants
 * All thresholds and tunables in one place.
 * Shared across all tracks. Do NOT hardcode these values elsewhere.
 */

export const AR_CONFIG = {
  // --- Frame Capture (Track A) ---
  CAPTURE_INTERVAL_MS: 500,          // How often to sample seller video (ms)
  SHARPNESS_THRESHOLD: 1,             // Mean pixel delta — lowered for laptop webcams (typical: 2–6)
  MIN_LUMINANCE: 80,                 // 0–255 scale, below = too dark
  MAX_LUMINANCE: 220,                // 0–255 scale, above = too bright
  STABILITY_DURATION_MS: 1500,       // How long conditions must hold before capture (1.5s)
  STABILITY_THRESHOLD: 12.0,          // Max mean pixel diff for "stable" — relaxed for laptop webcam
  JPEG_QUALITY: 0.85,                // canvas.toBlob quality

  // --- Buyer Pose Detection (Track B) ---
  MEDIAPIPE_MODEL_COMPLEXITY: 1,     // 0=lite, 1=full, 2=heavy
  MEDIAPIPE_MIN_DETECTION_CONF: 0.5,
  MEDIAPIPE_MIN_TRACKING_CONF: 0.5,
  EMA_ALPHA: 0.6,                    // Smoothing factor for keypoints (0–1)
  MIN_KEYPOINT_VISIBILITY: 0.5,      // Minimum visibility for shoulder/hip keypoints
  GARMENT_SHOULDER_PADDING: 1.5,    // 50% padding beyond shoulders for overlay sizing
  GARMENT_X_OVERHANG: 0.075,         // Slight left overhang ratio
  GARMENT_Y_NECKLINE: 0.12,          // Neckline offset — 12% above shoulder midpoint (sits on shoulders)
  GARMENT_MAX_HEIGHT_RATIO: 1.2,     // Max garment height as ratio of shoulder-to-hip distance

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
  API_BASE_URL: '', // Use relative URLs — Vite proxy forwards /api/* to localhost:3001
  SEGMENT_ENDPOINT: '/api/ar/segment-live',
  SESSION_DELETE_ENDPOINT: '/api/ar/sessions',
  SESSION_STATUS_ENDPOINT: '/api/ar/sessions',
  STATUS_POLL_INTERVAL_MS: 500,

  // --- Agora ---
  AGORA_APP_ID: import.meta.env.VITE_AGORA_APP_ID || '',
  AGORA_TEMP_TOKEN: import.meta.env.VITE_AGORA_TEMP_TOKEN || null,
};

export default AR_CONFIG;
