import { useState, useRef, useCallback, useEffect } from 'react';
import { AR_CONFIG } from '../config/arConfig';
import { calculateSharpness, calculateLuminance, calculateFrameDelta } from '../utils/frameQuality';
import { segmentLiveFrame } from '../utils/segmentApi';

const {
  CAPTURE_INTERVAL_MS,
  SHARPNESS_THRESHOLD,
  MIN_LUMINANCE,
  MAX_LUMINANCE,
  STABILITY_DURATION_MS,
  STABILITY_THRESHOLD,
  JPEG_QUALITY,
} = AR_CONFIG;

/**
 * useFrameCapture — Captures frames from the seller's local video,
 * scores quality, and triggers capture after stable period.
 *
 * Mannequin detection uses MediaPipe Pose to verify:
 * - Shoulders visible, torso centered, body large enough, hips visible.
 */

// ── Seller-side Pose singleton for mannequin detection ──
let sellerPoseInstance = null;
let sellerPoseInitPromise = null;
let lastPoseResult = null;

async function initSellerPose() {
  if (sellerPoseInstance) return sellerPoseInstance;
  if (sellerPoseInitPromise) return sellerPoseInitPromise;

  const Pose = window.Pose;
  if (!Pose) {
    console.warn('[FrameCapture] MediaPipe Pose CDN not loaded — mannequin check will auto-pass');
    return null;
  }

  sellerPoseInitPromise = (async () => {
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    pose.setOptions({
      modelComplexity: 0, // Lite model — fast for seller-side checks
      smoothLandmarks: false,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    pose.onResults((results) => {
      lastPoseResult = results;
    });
    await pose.initialize();
    sellerPoseInstance = pose;
    console.log('[FrameCapture] ✅ Seller Pose model initialized');
    return pose;
  })();

  return sellerPoseInitPromise;
}

/**
 * Detect mannequin/person in the frame using Pose landmarks.
 * Returns { detected, centered, largeEnough, hipsVisible, warnings[] }
 */
async function detectMannequin(canvas) {
  const pose = await initSellerPose();
  if (!pose) return { detected: true, warnings: [] }; // Fallback if CDN missing

  lastPoseResult = null;
  try {
    await pose.send({ image: canvas });
  } catch (e) {
    console.warn('[FrameCapture] Pose send failed:', e.message);
    return { detected: true, warnings: [] }; // Don't block on error
  }

  const results = lastPoseResult;
  if (!results || !results.poseLandmarks || results.poseLandmarks.length < 25) {
    return { detected: false, warnings: ['no_body'] };
  }

  const kp = results.poseLandmarks;
  const warnings = [];
  let detected = true;

  // 1. Shoulders visible (keypoints 11, 12)
  const ls = kp[11];
  const rs = kp[12];
  if (!ls || !rs || (ls.visibility || 0) < 0.5 || (rs.visibility || 0) < 0.5) {
    warnings.push('shoulders_not_visible');
    detected = false;
  }

  // 2. Torso centered (shoulder midpoint between 20%-80% of frame width)
  if (detected) {
    const midX = (ls.x + rs.x) / 2;
    if (midX < 0.2 || midX > 0.8) {
      warnings.push('not_centered');
      detected = false;
    }
  }

  // 3. Body large enough (shoulder width > 15% of frame)
  if (detected) {
    const shoulderWidth = Math.abs(ls.x - rs.x);
    if (shoulderWidth < 0.15) {
      warnings.push('too_far');
      detected = false;
    }
  }

  // 4. Hips visible (keypoints 23, 24)
  const lh = kp[23];
  const rh = kp[24];
  if (!lh || !rh || (lh.visibility || 0) < 0.3 || (rh.visibility || 0) < 0.3) {
    warnings.push('hips_not_visible');
    // Don't fail entirely — hips might be partially occluded
  }

  return { detected, warnings };
}
export function useFrameCapture(sellerVideoRef, isCapturing, sessionId, onCaptureComplete, onCaptureError) {
  const [captureStatus, setCaptureStatus] = useState('idle');
  const [countdown, setCountdown] = useState(0);
  const [qualityWarnings, setQualityWarnings] = useState([]);
  const [enforcementDetails, setEnforcementDetails] = useState({
    mannequin: false,
    lighting: false,
    stability: false,
    sharpness: 0,
    luminance: 0,
    frameDelta: 255,
  });

  const intervalRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const prevFrameDataRef = useRef(null);
  const stableStartRef = useRef(null);
  const isProcessingRef = useRef(false);
  // Store callbacks in refs to avoid stale closures in setInterval
  const onCompleteRef = useRef(onCaptureComplete);
  const onErrorRef = useRef(onCaptureError);
  const sessionIdRef = useRef(sessionId);

  // Keep refs current
  useEffect(() => { onCompleteRef.current = onCaptureComplete; }, [onCaptureComplete]);
  useEffect(() => { onErrorRef.current = onCaptureError; }, [onCaptureError]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Initialize hidden canvas
  useEffect(() => {
    if (!hiddenCanvasRef.current) {
      hiddenCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  /**
   * Get the actual <video> element from the Agora container.
   * Agora 4.x injects a <video> inside the div you pass to track.play().
   */
  const getVideoElement = useCallback(() => {
    if (!sellerVideoRef?.current) {
      console.warn('[FrameCapture] sellerVideoRef.current is null');
      return null;
    }
    const el = sellerVideoRef.current;
    if (el.tagName === 'VIDEO') return el;
    // Search for video inside the Agora container
    const video = el.querySelector('video');
    if (!video) {
      console.warn('[FrameCapture] No <video> element found inside container. Agora may not have initialized yet.');
    }
    return video;
  }, [sellerVideoRef]);

  /**
   * Draw the current seller video frame to the hidden canvas and return ImageData.
   */
  const captureFrameData = useCallback(() => {
    const videoEl = getVideoElement();
    if (!videoEl) return null;
    if (videoEl.readyState < 2) {
      console.warn('[FrameCapture] Video not ready (readyState:', videoEl.readyState, ')');
      return null;
    }

    const canvas = hiddenCanvasRef.current;
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    try {
      ctx.drawImage(videoEl, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h);
    } catch (e) {
      console.warn('[FrameCapture] Canvas tainted (cross-origin):', e.message);
      return null;
    }
  }, [getVideoElement]);

  /**
   * Trigger the actual frame capture and send to backend.
   */
  const triggerCapture = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setCaptureStatus('capturing');

    try {
      const canvas = hiddenCanvasRef.current;
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
          'image/jpeg',
          JPEG_QUALITY
        );
      });

      setCaptureStatus('sent');
      console.log('[FrameCapture] 📤 Sending frame to backend for segmentation...');

      const result = await segmentLiveFrame(blob, sessionIdRef.current);

      if (result.success) {
        console.log('[FrameCapture] ✅ Segmentation success:', result.png_url);
        onCompleteRef.current?.(result);
      } else {
        throw new Error(result.message || 'Segmentation failed');
      }
    } catch (err) {
      console.error('[FrameCapture] ❌ Capture failed:', err);
      setCaptureStatus('idle');
      onErrorRef.current?.(err.message || 'Capture failed');
    } finally {
      isProcessingRef.current = false;
      stableStartRef.current = null;
    }
  }, []);

  // Start/stop capture loop based on isCapturing
  useEffect(() => {
    if (!isCapturing) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCaptureStatus('idle');
      setCountdown(0);
      setQualityWarnings([]);
      prevFrameDataRef.current = null;
      stableStartRef.current = null;
      return;
    }

    console.log('[FrameCapture] 🟢 Capture loop STARTED (interval:', CAPTURE_INTERVAL_MS, 'ms)');
    setCaptureStatus('scanning');
    prevFrameDataRef.current = null;
    stableStartRef.current = null;
    setCountdown(0);

    // ── The analysis function — defined INSIDE the effect to avoid stale closures ──
    const analyze = async () => {
      if (isProcessingRef.current) return;

      const frameData = captureFrameData();
      if (!frameData) return; // Warnings already logged in captureFrameData

      const warnings = [];
      const details = {
        mannequin: false,
        lighting: false,
        stability: false,
        sharpness: 0,
        luminance: 0,
        frameDelta: 255,
      };

      // 0. Mannequin detection (MediaPipe Pose on seller's frame)
      const mannequinResult = await detectMannequin(hiddenCanvasRef.current);
      details.mannequin = mannequinResult.detected;
      if (!mannequinResult.detected) {
        warnings.push(...mannequinResult.warnings);
      }
      // 1. Sharpness
      const sharpness = calculateSharpness(frameData);
      details.sharpness = sharpness;
      if (sharpness < SHARPNESS_THRESHOLD) {
        warnings.push('low_sharpness');
      }

      // 2. Luminance
      const luminance = calculateLuminance(frameData);
      details.luminance = luminance;
      details.lighting = luminance >= MIN_LUMINANCE && luminance <= MAX_LUMINANCE;
      if (!details.lighting) {
        warnings.push(luminance < MIN_LUMINANCE ? 'too_dark' : 'too_bright');
      }

      // 3. Stability (frame delta)
      if (prevFrameDataRef.current) {
        const delta = calculateFrameDelta(prevFrameDataRef.current, frameData);
        details.frameDelta = delta;
        details.stability = delta < STABILITY_THRESHOLD;
        if (!details.stability) {
          warnings.push('unstable');
        }
      } else {
        // First frame — can't compare yet, auto-fail stability
        details.stability = false;
        details.frameDelta = 255;
      }
      prevFrameDataRef.current = frameData;

      setEnforcementDetails(details);
      setQualityWarnings(warnings);

      // Log every frame — use console.log not console.debug so it shows in Chrome
      console.log(
        `[FrameCapture] mannequin=${details.mannequin ? '✓' : '✗'}${mannequinResult.warnings.length ? '(' + mannequinResult.warnings.join(',') + ')' : ''} lighting=${details.lighting ? '✓' : '✗'}(${Math.round(luminance)}) ` +
        `stability=${details.stability ? '✓' : '✗'}(Δ${Math.round(details.frameDelta * 10) / 10}) ` +
        `sharp=${Math.round(sharpness)} | ` +
        (stableStartRef.current
          ? `countdown: ${Math.round((Date.now() - stableStartRef.current) / 1000)}s / ${STABILITY_DURATION_MS / 1000}s`
          : 'waiting for all checks to pass...')
      );

      // Evaluate all conditions
      const allRulesMet =
        details.mannequin &&
        details.lighting &&
        details.stability &&
        sharpness >= SHARPNESS_THRESHOLD;

      if (allRulesMet) {
        if (!stableStartRef.current) {
          stableStartRef.current = Date.now();
          setCaptureStatus('counting_down');
          console.log('[FrameCapture] ✅ ALL CHECKS PASSED — countdown started!');
        }

        const elapsed = Date.now() - stableStartRef.current;
        const remaining = Math.max(0, Math.ceil((STABILITY_DURATION_MS - elapsed) / 1000));
        setCountdown(remaining);

        if (elapsed >= STABILITY_DURATION_MS) {
          console.log('[FrameCapture] 🎯 Stability hold complete — CAPTURING!');
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          await triggerCapture();
        }
      } else {
        // Rules broken — reset countdown
        if (stableStartRef.current) {
          console.log('[FrameCapture] ⚠️ Check failed, countdown reset');
          stableStartRef.current = null;
          setCountdown(0);
        }
        setCaptureStatus('scanning');
      }
    };

    intervalRef.current = setInterval(analyze, CAPTURE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCapturing, captureFrameData, triggerCapture]);

  // Reset function for new garment cycle
  const resetCapture = useCallback(() => {
    setCaptureStatus('idle');
    setCountdown(0);
    setQualityWarnings([]);
    prevFrameDataRef.current = null;
    stableStartRef.current = null;
    isProcessingRef.current = false;
  }, []);

  return {
    captureStatus,
    countdown,
    qualityWarnings,
    enforcementDetails,
    resetCapture,
  };
}
