import { useState, useEffect, useRef } from 'react';
import { useSessionState } from '../../context/SessionContext';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { useGarmentOverlay } from '../../hooks/useGarmentOverlay';

/**
 * BuyerARPanel — Real AR overlay using MediaPipe Pose.
 * Renders INSIDE the ar-video-container as an absolute overlay.
 * Garment is anchored to the buyer's shoulders/hips via pose detection.
 * Falls back to centered overlay if pose detection fails.
 */
export default function BuyerARPanel({ videoRef }) {
  const { capturedGarmentUrl } = useSessionState();
  const canvasRef = useRef(null);
  const [useFallback, setUseFallback] = useState(false);
  const [garmentScale, setGarmentScale] = useState(80); // percentage of container width
  const [garmentLoaded, setGarmentLoaded] = useState(false);
  const [garmentError, setGarmentError] = useState(false);

  // --- Get the actual <video> element from the Agora container ---
  const videoElRef = useRef(null);
  useEffect(() => {
    const container = videoRef?.current;
    if (!container) return;

    // Poll briefly for the Agora-injected <video> element
    const findVideo = () => {
      const vid = container.querySelector('video');
      if (vid) {
        videoElRef.current = vid;
        console.log('[BuyerARPanel] Found Agora <video> element:', vid.videoWidth, 'x', vid.videoHeight);
      }
    };
    findVideo();
    const timer = setInterval(findVideo, 500);
    return () => clearInterval(timer);
  }, [videoRef]);

  // --- MediaPipe Pose Detection (real AR) ---
  const { keypoints, isModelLoaded, fps } = usePoseDetection(videoElRef, !useFallback);

  // If pose doesn't load within 10s, switch to fallback
  useEffect(() => {
    if (isModelLoaded) return;
    const timeout = setTimeout(() => {
      if (!isModelLoaded) {
        console.warn('[BuyerARPanel] ⚠️ MediaPipe Pose not loaded after 10s, using fallback overlay');
        setUseFallback(true);
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [isModelLoaded]);

  // --- Garment Overlay (anchored to pose keypoints) ---
  const { screenshotFn } = useGarmentOverlay(canvasRef, videoElRef, keypoints, capturedGarmentUrl);

  // Reset states on URL change
  useEffect(() => {
    setGarmentLoaded(false);
    setGarmentError(false);
  }, [capturedGarmentUrl]);

  console.log('[BuyerARPanel] garmentUrl:', capturedGarmentUrl, '| poseLoaded:', isModelLoaded, '| fallback:', useFallback, '| fps:', fps);

  if (!capturedGarmentUrl) {
    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', color: '#90cdf4', fontSize: 14,
      }}>
        ⏳ Waiting for garment from seller...
      </div>
    );
  }

  return (
    <>
      {/* Canvas for pose-anchored garment rendering */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
          zIndex: 15,
          transform: 'scaleX(-1)', // Mirror to match selfie view
        }}
      />

      {/* Fallback: simple positioned <img> if pose detection fails */}
      {useFallback && (
        <img
          src={capturedGarmentUrl}
          alt="Garment overlay"
          crossOrigin="anonymous"
          onLoad={() => { setGarmentLoaded(true); setGarmentError(false); }}
          onError={() => { setGarmentError(true); }}
          style={{
            position: 'absolute',
            top: '15%', left: '50%',
            transform: 'translateX(-50%)',
            width: `${garmentScale}%`,
            opacity: garmentLoaded ? 0.8 : 0,
            zIndex: 16,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
            transition: 'opacity 0.3s ease, width 0.2s ease',
          }}
        />
      )}

      {/* Status badge */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, padding: '4px 14px', borderRadius: 20,
        fontSize: 12, fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        background: isModelLoaded ? 'rgba(72, 187, 120, 0.9)' : (useFallback ? 'rgba(245, 158, 11, 0.9)' : 'rgba(99, 179, 237, 0.9)'),
        color: '#fff',
      }}>
        {isModelLoaded
          ? `✨ AR Active (${fps} FPS)`
          : useFallback
            ? '🔄 Fallback Overlay'
            : '🔍 Loading pose detection...'}
      </div>

      {/* Size slider (fallback mode only) */}
      {useFallback && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 8,
          color: '#e2e8f0', fontSize: 11,
        }}>
          <span>Size</span>
          <input type="range" min={30} max={90} value={garmentScale}
            onChange={(e) => setGarmentScale(Number(e.target.value))}
            style={{ width: 80, cursor: 'pointer' }}
          />
        </div>
      )}

      {/* Screenshot button */}
      <button
        onClick={() => {
          if (!useFallback && screenshotFn) {
            screenshotFn();
          } else {
            // Fallback screenshot
            const container = videoRef?.current;
            if (!container) return;
            const videoEl = container.querySelector('video');
            if (!videoEl) return;
            const W = videoEl.videoWidth || 640;
            const H = videoEl.videoHeight || 480;
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            const ctx = c.getContext('2d');
            ctx.drawImage(videoEl, 0, 0, W, H);
            c.toBlob((blob) => {
              if (!blob) return;
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `ar-try-on-${Date.now()}.jpg`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 5000);
            }, 'image/jpeg', 0.85);
          }
        }}
        style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 20,
          padding: '6px 14px',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: '#fff', border: 'none', borderRadius: 8,
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        📷 Screenshot
      </button>

      {/* Error state */}
      {garmentError && useFallback && (
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 20, color: '#fc8181', fontSize: 14, textAlign: 'center',
          background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: 8,
        }}>
          ❌ Failed to load garment image
        </div>
      )}
    </>
  );
}
