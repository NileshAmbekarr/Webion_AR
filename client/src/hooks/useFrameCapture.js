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
  MIN_KEYPOINT_VISIBILITY,
} = AR_CONFIG;

/**
 * useFrameCapture — Captures frames from the seller's Agora remote video,
 * scores quality, detects mannequin via MediaPipe Pose, and triggers capture
 * after 3 seconds of stability.
 *
 * @param {React.RefObject} sellerVideoRef — ref to <video> element or container for seller's Agora stream
 * @param {boolean} isCapturing — true when seller has pressed "Present Garment"
 * @param {string} sessionId — current session UUID
 * @param {Function} onCaptureComplete — callback with { png_url, session_id, processing_time_ms }
 * @param {Function} onCaptureError — callback with error message
 */
export function useFrameCapture(sellerVideoRef, isCapturing, sessionId, onCaptureComplete, onCaptureError) {
  const [captureStatus, setCaptureStatus] = useState('idle');
  // 'idle' | 'scanning' | 'mannequin_detected' | 'counting_down' | 'capturing' | 'sent'
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
  const poseRef = useRef(null);
  const isProcessingRef = useRef(false);

  // Initialize hidden canvas
  useEffect(() => {
    if (!hiddenCanvasRef.current) {
      hiddenCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  // Initialize MediaPipe Pose (for mannequin detection on seller frames)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Pose && !poseRef.current) {
      const pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: false, // not needed for single-frame detection
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      poseRef.current = pose;
    }
  }, []);

  /**
   * Get the actual <video> element from a ref.
   * Handles both direct video refs and Agora container refs.
   */
  const getVideoElement = useCallback(() => {
    if (!sellerVideoRef?.current) return null;
    const el = sellerVideoRef.current;
    if (el.tagName === 'VIDEO') return el;
    // If it's a container (Agora 4.x plays into a div), find the video inside
    return el.querySelector('video');
  }, [sellerVideoRef]);

  /**
   * Draw the current seller video frame to the hidden canvas and return ImageData.
   */
  const captureFrameData = useCallback(() => {
    const videoEl = getVideoElement();
    if (!videoEl || videoEl.readyState < 2) return null;

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
      // Canvas may be tainted (cross-origin)
      console.warn('[FrameCapture] Canvas tainted:', e);
      return null;
    }
  }, [getVideoElement]);

  /**
   * Check if mannequin keypoints are present in the current frame.
   */
  const checkMannequinPresence = useCallback(async (canvas) => {
    if (!poseRef.current) return false;

    return new Promise((resolve) => {
      poseRef.current.onResults((results) => {
        if (!results.poseLandmarks) {
          resolve(false);
          return;
        }
        const lm = results.poseLandmarks;
        // Check shoulders (11, 12) and hips (23, 24) visibility
        const hasShoulders =
          lm[11]?.visibility > MIN_KEYPOINT_VISIBILITY &&
          lm[12]?.visibility > MIN_KEYPOINT_VISIBILITY;
        const hasHips =
          lm[23]?.visibility > 0.4 &&
          lm[24]?.visibility > 0.4;
        resolve(hasShoulders && hasHips);
      });
      poseRef.current.send({ image: canvas });
    });
  }, []);

  /**
   * Main capture loop — runs every CAPTURE_INTERVAL_MS when isCapturing is true.
   */
  const analyzeFrame = useCallback(async () => {
    if (isProcessingRef.current) return;

    const frameData = captureFrameData();
    if (!frameData) {
      console.warn('[FrameCapture] No frame data — video element not ready or not playing');
      return;
    }

    const warnings = [];
    const details = { ...enforcementDetails };

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
      details.stability = false;
      details.frameDelta = 255;
    }
    prevFrameDataRef.current = frameData;

    // 4. Mannequin presence (async)
    // If MediaPipe hasn't loaded from CDN, skip mannequin check (treat as passed)
    let mannequinDetected = false;
    if (!poseRef.current) {
      // MediaPipe not loaded — auto-pass mannequin check for demo
      mannequinDetected = true;
      if (!window._mpWarningShown) {
        console.warn('[FrameCapture] MediaPipe Pose not loaded. Mannequin check auto-passed. Ensure CDN scripts are in index.html.');
        window._mpWarningShown = true;
      }
    } else {
      try {
        mannequinDetected = await checkMannequinPresence(hiddenCanvasRef.current);
      } catch (e) {
        console.warn('[FrameCapture] Mannequin detection error:', e);
        mannequinDetected = true; // Fail-open for demo
      }
    }
    details.mannequin = mannequinDetected;

    setEnforcementDetails(details);
    setQualityWarnings(warnings);

    // Debug log every few frames
    console.debug(
      `[FrameCapture] mannequin=${mannequinDetected} lighting=${details.lighting}(${Math.round(luminance)}) ` +
      `stability=${details.stability}(Δ${Math.round(details.frameDelta * 10) / 10}) ` +
      `sharpness=${Math.round(sharpness)} countdown=${stableStartRef.current ? Math.round((Date.now() - stableStartRef.current) / 1000) + 's' : '-'}`
    );

    // Evaluate all conditions
    const allRulesMet =
      mannequinDetected &&
      details.lighting &&
      details.stability &&
      sharpness >= SHARPNESS_THRESHOLD;

    if (allRulesMet) {
      if (!stableStartRef.current) {
        stableStartRef.current = Date.now();
        setCaptureStatus('counting_down');
        console.log('[FrameCapture] ✅ All rules met — countdown started');
      }

      const elapsed = Date.now() - stableStartRef.current;
      const remaining = Math.max(0, Math.ceil((STABILITY_DURATION_MS - elapsed) / 1000));
      setCountdown(remaining);

      if (elapsed >= STABILITY_DURATION_MS) {
        console.log('[FrameCapture] 🎯 Stability hold complete — triggering capture!');
        await triggerCapture();
      }
    } else {
      // Rules broken — reset countdown
      if (stableStartRef.current) {
        stableStartRef.current = null;
        setCountdown(0);
        setCaptureStatus(mannequinDetected ? 'mannequin_detected' : 'scanning');
      } else {
        setCaptureStatus(mannequinDetected ? 'mannequin_detected' : 'scanning');
      }
    }
  }, [captureFrameData, checkMannequinPresence, enforcementDetails]);

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

      // Send to backend
      const result = await segmentLiveFrame(blob, sessionId);

      if (result.success) {
        onCaptureComplete?.(result);
      } else {
        throw new Error(result.message || 'Segmentation failed');
      }
    } catch (err) {
      console.error('[FrameCapture] Capture failed:', err);
      setCaptureStatus('idle');
      onCaptureError?.(err.message || 'Capture failed');
    } finally {
      isProcessingRef.current = false;
      stableStartRef.current = null;
    }
  }, [sessionId, onCaptureComplete, onCaptureError]);

  // Start/stop capture loop based on isCapturing
  useEffect(() => {
    if (isCapturing) {
      setCaptureStatus('scanning');
      prevFrameDataRef.current = null;
      stableStartRef.current = null;
      setCountdown(0);

      intervalRef.current = setInterval(() => {
        analyzeFrame();
      }, CAPTURE_INTERVAL_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCaptureStatus('idle');
      setCountdown(0);
      setQualityWarnings([]);
      prevFrameDataRef.current = null;
      stableStartRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCapturing, analyzeFrame]);

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
