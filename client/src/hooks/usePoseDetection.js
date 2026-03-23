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

/**
 * usePoseDetection — Track B
 * Runs MediaPipe Pose on the buyer's video stream.
 *
 * @param {React.RefObject} videoRef — ref to the buyer <video> element
 *
 * Returns:
 *   keypoints     — smoothed NormalizedLandmarkList | null
 *   isModelLoaded — boolean
 *   fps           — frames per second (rolling average over 30 frames)
 */
export function usePoseDetection(videoRef) {
  const [keypoints, setKeypoints] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [fps, setFps] = useState(0);

  // Internal refs — survive renders without triggering them
  const prevKeypoints = useRef(null);
  const frameTimestamps = useRef([]); // store last 30 frame times for FPS calc
  const poseRef = useRef(null);
  const cameraRef = useRef(null);
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
    activeRef.current = true;

    // MediaPipe is loaded via CDN as a global (window.Pose, window.Camera)
    const Pose = window.Pose;
    const Camera = window.Camera;

    if (!Pose || !Camera) {
      console.warn('[usePoseDetection] MediaPipe globals not available. Check CDN scripts in index.html.');
      return;
    }

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

    pose.onResults(onResults);
    poseRef.current = pose;

    pose.initialize().then(() => {
      if (!activeRef.current) return;
      setIsModelLoaded(true);

      const videoEl = videoRef.current;
      if (!videoEl) return;

      const camera = new Camera(videoEl, {
        onFrame: async () => {
          if (activeRef.current && poseRef.current) {
            await poseRef.current.send({ image: videoEl });
          }
        },
        width: 1280,
        height: 720,
      });

      camera.start();
      cameraRef.current = camera;
    }).catch((err) => {
      console.error('[usePoseDetection] Pose initialization error:', err);
    });

    return () => {
      activeRef.current = false;
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (poseRef.current) {
        poseRef.current.close();
        poseRef.current = null;
      }
      setKeypoints(null);
      setIsModelLoaded(false);
      setFps(0);
      prevKeypoints.current = null;
      frameTimestamps.current = [];
    };
  }, [videoRef, onResults]);

  return { keypoints, isModelLoaded, fps };
}
