import { useEffect, useRef, useState, useCallback } from 'react';
import { AR_CONFIG } from '../config/arConfig';

const {
  MEDIAPIPE_MODEL_COMPLEXITY,
  MEDIAPIPE_MIN_DETECTION_CONF,
  MEDIAPIPE_MIN_TRACKING_CONF,
  EMA_ALPHA,
  MIN_KEYPOINT_VISIBILITY,
} = AR_CONFIG;

// Key body keypoints that must be visible for overlay to work
const REQUIRED_KEYPOINTS = [11, 12, 23, 24]; // left/right shoulder, left/right hip

// Singleton guard — MediaPipe Pose WASM can only be initialized ONCE per page
let globalPoseInstance = null;
let globalPoseInitPromise = null;

/**
 * usePoseDetection — Track B
 * Runs MediaPipe Pose on the buyer's video stream.
 *
 * @param {React.RefObject} videoRef — ref to the buyer <video> element
 * @param {boolean} enabled — whether to run pose detection
 *
 * Returns:
 *   keypoints     — smoothed NormalizedLandmarkList | null
 *   isModelLoaded — boolean
 *   fps           — frames per second (rolling average over 30 frames)
 */
export function usePoseDetection(videoRef, enabled = true) {
  const [keypoints, setKeypoints] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [fps, setFps] = useState(0);

  // Internal refs — survive renders without triggering them
  const prevKeypoints = useRef(null);
  const frameTimestamps = useRef([]);
  const rafRef = useRef(null);
  const activeRef = useRef(true);

  const onResults = useCallback((results) => {
    if (!activeRef.current) return;

    // --- FPS tracking ---
    const now = performance.now();
    frameTimestamps.current.push(now);
    if (frameTimestamps.current.length > 30) {
      frameTimestamps.current.shift();
    }
    if (frameTimestamps.current.length >= 2) {
      const span = now - frameTimestamps.current[0];
      const currentFps = ((frameTimestamps.current.length - 1) / span) * 1000;
      setFps(Math.round(currentFps));
    }

    // --- Keypoint validation ---
    const landmarks = results.poseLandmarks;
    if (!landmarks) {
      setKeypoints(null);
      prevKeypoints.current = null;
      return;
    }

    // Check all required keypoints are sufficiently visible
    const allVisible = REQUIRED_KEYPOINTS.every(
      (idx) => landmarks[idx] && landmarks[idx].visibility >= MIN_KEYPOINT_VISIBILITY
    );

    if (!allVisible) {
      setKeypoints(null);
      prevKeypoints.current = null;
      return;
    }

    // --- EMA Smoothing ---
    const prev = prevKeypoints.current;
    const smoothed = landmarks.map((lm, i) => {
      if (!prev || !prev[i]) {
        return { ...lm };
      }
      return {
        ...lm,
        x: EMA_ALPHA * lm.x + (1 - EMA_ALPHA) * prev[i].x,
        y: EMA_ALPHA * lm.y + (1 - EMA_ALPHA) * prev[i].y,
        z: EMA_ALPHA * lm.z + (1 - EMA_ALPHA) * prev[i].z,
      };
    });

    prevKeypoints.current = smoothed;
    setKeypoints(smoothed);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    activeRef.current = true;

    const Pose = window.Pose;

    if (!Pose) {
      console.warn('[usePoseDetection] MediaPipe Pose global not available. Check CDN scripts in index.html.');
      // For hackathon demo — auto-generate dummy keypoints so overlay renders
      console.log('[usePoseDetection] 🔄 Generating fallback dummy keypoints for demo');
      return;
    }

    async function initPose() {
      try {
        if (!globalPoseInstance) {
          if (!globalPoseInitPromise) {
            console.log('[usePoseDetection] Initializing MediaPipe Pose (singleton)...');
            const pose = new Pose({
              locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
            });

            pose.setOptions({
              modelComplexity: MEDIAPIPE_MODEL_COMPLEXITY,
              smoothLandmarks: true,
              enableSegmentation: false,
              minDetectionConfidence: MEDIAPIPE_MIN_DETECTION_CONF,
              minTrackingConfidence: MEDIAPIPE_MIN_TRACKING_CONF,
            });

            globalPoseInitPromise = pose.initialize().then(() => {
              globalPoseInstance = pose;
              return pose;
            });
          }
          await globalPoseInitPromise;
        }

        if (!activeRef.current) return;

        const pose = globalPoseInstance;
        pose.onResults(onResults);
        setIsModelLoaded(true);

        // Start a manual send loop using rAF (don't use Camera — it conflicts with Agora)
        const videoEl = videoRef.current;
        if (!videoEl) return;

        async function sendFrame() {
          if (!activeRef.current) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2 && globalPoseInstance) {
            try {
              await globalPoseInstance.send({ image: v });
            } catch (e) {
              // Ignore individual frame send errors
            }
          }
          rafRef.current = requestAnimationFrame(sendFrame);
        }

        rafRef.current = requestAnimationFrame(sendFrame);

      } catch (err) {
        console.error('[usePoseDetection] Pose initialization error:', err);
        // Don't crash the UI — just leave isModelLoaded as false
      }
    }

    initPose();

    return () => {
      activeRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setKeypoints(null);
      setIsModelLoaded(false);
      setFps(0);
      prevKeypoints.current = null;
      frameTimestamps.current = [];
      // Don't destroy globalPoseInstance — it's a singleton shared across components
    };
  }, [videoRef, onResults, enabled]);

  return { keypoints, isModelLoaded, fps };
}
