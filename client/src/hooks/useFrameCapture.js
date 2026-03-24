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
 * Mannequin detection uses lightweight canvas analysis (no WASM)
 * to avoid conflicts with buyer's MediaPipe Pose instance.
 */

/**
 * Lightweight mannequin detection — NO MediaPipe, NO WASM.
 * Checks if there's a significant object in the center of the frame
 * by comparing edge density in center vs corners.
 */
function detectMannequinSimple(imageData) {
  const { data, width, height } = imageData;
  const warnings = [];

  // Helper: calculate edge density in a region
  function edgeDensity(startX, startY, regionW, regionH) {
    let edges = 0;
    let count = 0;
    for (let y = startY; y < startY + regionH && y < height - 1; y++) {
      for (let x = startX; x < startX + regionW && x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const idxR = (y * width + x + 1) * 4;
        const idxD = ((y + 1) * width + x) * 4;
        const dx = Math.abs(data[idx] - data[idxR]) + Math.abs(data[idx+1] - data[idxR+1]) + Math.abs(data[idx+2] - data[idxR+2]);
        const dy = Math.abs(data[idx] - data[idxD]) + Math.abs(data[idx+1] - data[idxD+1]) + Math.abs(data[idx+2] - data[idxD+2]);
        if (dx + dy > 30) edges++;
        count++;
      }
    }
    return count > 0 ? edges / count : 0;
  }

  const regionW = Math.floor(width * 0.3);
  const regionH = Math.floor(height * 0.3);

  // Center region
  const centerX = Math.floor(width * 0.35);
  const centerY = Math.floor(height * 0.25);
  const centerEdge = edgeDensity(centerX, centerY, regionW, regionH);

  // Corner regions (average of top-left and top-right)
  const tlEdge = edgeDensity(0, 0, regionW, regionH);
  const trEdge = edgeDensity(width - regionW, 0, regionW, regionH);
  const cornerEdge = (tlEdge + trEdge) / 2;

  // 1. Center must have meaningful content (edge density > 5%)
  if (centerEdge < 0.05) {
    warnings.push('no_object_detected');
    return { detected: false, warnings };
  }

  // 2. Center should have more edges than corners (object in middle)
  if (centerEdge < cornerEdge * 1.2) {
    warnings.push('not_centered');
    return { detected: false, warnings };
  }

  return { detected: true, warnings };
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

      // 0. Mannequin detection (lightweight edge-density, no WASM)
      const mannequinResult = detectMannequinSimple(frameData);
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
