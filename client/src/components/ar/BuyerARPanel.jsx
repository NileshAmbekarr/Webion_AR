import { useRef, useState, useMemo } from 'react';
import { useCamera }          from '../../hooks/useCamera';
import { usePoseDetection }   from '../../hooks/usePoseDetection';
import { useGarmentOverlay }  from '../../hooks/useGarmentOverlay';
import { useSessionState }    from '../../context/SessionContext';
import { AR_CONFIG }          from '../../config/arConfig';
import { pixelsToCm }         from '../../utils/sizeRecommendation';
import CameraGuide from './CameraGuide';
import SizeCard    from './SizeCard';
import './buyer-ar.css';

const {
  BUYER_TOO_CLOSE_THRESHOLD,
  BUYER_TOO_FAR_THRESHOLD,
} = AR_CONFIG;

const IS_DEV = import.meta.env.DEV;

/**
 * BuyerARPanel — Track B
 * Orchestrates the buyer's camera, pose detection, garment overlay,
 * size card, camera guide, and screenshot functionality.
 */
export default function BuyerARPanel() {
  const { capturedGarmentUrl } = useSessionState();
  const garmentUrl = capturedGarmentUrl || '/test_garment.png'; // dev fallback

  // ── Core hooks ───────────────────────────────────────────────────────────
  const { videoRef, isLoading, error } = useCamera();
  const { keypoints, isModelLoaded, fps } = usePoseDetection(videoRef);

  const canvasRef = useRef(null);
  const { screenshotFn } = useGarmentOverlay(canvasRef, videoRef, keypoints, garmentUrl);

  // ── Camera guide state ───────────────────────────────────────────────────
  const [guideVisible, setGuideVisible] = useState(true);

  // ── Distance detection ───────────────────────────────────────────────────
  const distanceWarning = useMemo(() => {
    if (!keypoints || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const W = canvas.width || canvas.offsetWidth || 1;
    const LS = keypoints[11];
    const RS = keypoints[12];
    if (!LS || !RS) return null;

    const shoulderPx = Math.hypot((LS.x - RS.x) * W, (LS.y - RS.y) * W);
    const ratio = shoulderPx / W;

    if (ratio > BUYER_TOO_CLOSE_THRESHOLD) return '🔍 Move further back';
    if (ratio < BUYER_TOO_FAR_THRESHOLD)  return '↔️ Move closer to camera';
    return null;
  }, [keypoints]);

  // ── Buyer shoulder px (for SizeCard) ────────────────────────────────────
  const buyerShoulderPx = useMemo(() => {
    if (!keypoints || !canvasRef.current) return 0;
    const W = canvasRef.current.width || canvasRef.current.offsetWidth || 1;
    const LS = keypoints[11];
    const RS = keypoints[12];
    if (!LS || !RS) return 0;
    return Math.hypot((LS.x - RS.x) * W, (LS.y - RS.y) * W);
  }, [keypoints]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="buyer-ar-panel">

      {/* ─── Camera viewport ─────────────────────────────── */}
      <div className="buyer-ar-viewport">
        <video
          ref={videoRef}
          className="buyer-ar-video"
          playsInline
          muted
          autoPlay
          aria-label="Buyer camera view"
        />

        <canvas
          ref={canvasRef}
          className="buyer-ar-canvas"
          aria-hidden="true"
        />

        {/* Camera guide — shown on first activation */}
        {!isLoading && !error && guideVisible && (
          <CameraGuide onDismiss={() => setGuideVisible(false)} />
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="buyer-ar-overlay-message">
            <div className="spinner" />
            <p>Activating camera…</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="buyer-ar-overlay-message error">
            <p>
              {error === 'denied'
                ? '📵 Camera access was denied. Please allow camera permissions and refresh.'
                : '❌ Camera not available on this device.'}
            </p>
          </div>
        )}

        {/* Model loading indicator */}
        {!isLoading && !error && !isModelLoaded && (
          <div className="buyer-ar-overlay-message">
            <div className="spinner" />
            <p>Loading pose model…</p>
          </div>
        )}

        {/* Distance warning */}
        {distanceWarning && isModelLoaded && (
          <div className="buyer-ar-distance-warning" role="alert">
            {distanceWarning}
          </div>
        )}

        {/* Dev debug bar */}
        {IS_DEV && (
          <div className="buyer-ar-debug">
            keypoints={keypoints ? keypoints.length : 0} &nbsp;|&nbsp; fps={fps} &nbsp;|&nbsp;
            model={isModelLoaded ? '✓' : '…'}
          </div>
        )}
      </div>

      {/* ─── Size card ───────────────────────────────────── */}
      <SizeCard
        garmentShoulderCm={null}   /* TODO: wire from Track D response */
        garmentChestCm={null}
        garmentLengthCm={null}
        buyerShoulderPx={buyerShoulderPx}
        videoWidthPx={canvasRef.current?.width ?? 0}
      />

      {/* ─── Screenshot button ───────────────────────────── */}
      <button
        id="buyer-ar-screenshot-btn"
        className="buyer-ar-screenshot-btn"
        onClick={screenshotFn}
        disabled={!isModelLoaded || !!error}
        aria-label="Capture AR try-on screenshot"
      >
        📷 Screenshot
      </button>
    </div>
  );
}
