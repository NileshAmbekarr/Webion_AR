import { useRef, useState, useMemo } from 'react';
import { usePoseDetection }   from '../../hooks/usePoseDetection';
import { useGarmentOverlay }  from '../../hooks/useGarmentOverlay';
import { useSessionState }    from '../../context/SessionContext';
import { AR_CONFIG }          from '../../config/arConfig';
import SizeCard    from './SizeCard';
import './buyer-ar.css';

const {
  BUYER_TOO_CLOSE_THRESHOLD,
  BUYER_TOO_FAR_THRESHOLD,
} = AR_CONFIG;

const IS_DEV = import.meta.env.DEV;

/**
 * BuyerARPanel — Track B
 * Orchestrates the buyer's pose detection, garment overlay,
 * size card, and screenshot functionality.
 * 
 * IMPORTANT: Does NOT create its own camera — uses the Agora local video
 * ref passed from ARSessionPanel to avoid conflicts.
 */
export default function BuyerARPanel({ videoRef }) {
  const { capturedGarmentUrl } = useSessionState();
  const garmentUrl = capturedGarmentUrl;

  // ── Pose detection (uses the same video element Agora plays into) ─────
  const { keypoints, isModelLoaded, fps } = usePoseDetection(videoRef, !!garmentUrl);

  const canvasRef = useRef(null);
  const { screenshotFn } = useGarmentOverlay(canvasRef, videoRef, keypoints, garmentUrl);

  // ── Distance detection ─────────────────────────────────────────────────
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

  // ── Buyer shoulder px (for SizeCard) ───────────────────────────────────
  const buyerShoulderPx = useMemo(() => {
    if (!keypoints || !canvasRef.current) return 0;
    const W = canvasRef.current.width || canvasRef.current.offsetWidth || 1;
    const LS = keypoints[11];
    const RS = keypoints[12];
    if (!LS || !RS) return 0;
    return Math.hypot((LS.x - RS.x) * W, (LS.y - RS.y) * W);
  }, [keypoints]);

  if (!garmentUrl) {
    return (
      <div className="buyer-ar-panel" style={{ padding: 16, textAlign: 'center', color: 'var(--ar-text-muted)' }}>
        Waiting for seller to present a garment...
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="buyer-ar-panel">
      {/* Garment overlay canvas sits on top of the buyer's existing video */}
      <div className="buyer-ar-viewport" style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          className="buyer-ar-canvas"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />

        {/* Model loading indicator */}
        {!isModelLoaded && (
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

      {/* ─── Size card ────────────────────────────────────── */}
      <SizeCard
        garmentShoulderCm={null}
        garmentChestCm={null}
        garmentLengthCm={null}
        buyerShoulderPx={buyerShoulderPx}
        videoWidthPx={canvasRef.current?.width ?? 0}
      />

      {/* ─── Screenshot button ────────────────────────────── */}
      <button
        id="buyer-ar-screenshot-btn"
        className="buyer-ar-screenshot-btn"
        onClick={screenshotFn}
        disabled={!isModelLoaded}
        aria-label="Capture AR try-on screenshot"
      >
        📷 Screenshot
      </button>
    </div>
  );
}
