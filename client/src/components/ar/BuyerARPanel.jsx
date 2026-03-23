import { useRef, useState } from 'react';
import { useSessionState }    from '../../context/SessionContext';
import './buyer-ar.css';

/**
 * BuyerARPanel — Hackathon demo version
 * Shows the segmented garment image overlaid on the buyer's video area.
 * Simplified: no MediaPipe pose detection (unreliable with WASM conflicts).
 * The garment is displayed as a centered, semi-transparent overlay.
 */
export default function BuyerARPanel({ videoRef }) {
  const { capturedGarmentUrl } = useSessionState();
  const garmentUrl = capturedGarmentUrl;
  const [garmentLoaded, setGarmentLoaded] = useState(false);
  const [garmentError, setGarmentError] = useState(false);

  if (!garmentUrl) {
    return (
      <div className="buyer-ar-panel" style={{ padding: 16, textAlign: 'center', color: 'var(--ar-text-muted)' }}>
        Waiting for seller to present a garment...
      </div>
    );
  }

  const handleScreenshot = () => {
    // Get the Agora video element inside the ref div
    const container = videoRef?.current;
    if (!container) return;

    const videoEl = container.querySelector('video');
    if (!videoEl) {
      console.warn('[BuyerARPanel] No video element found in container');
      return;
    }

    const W = videoEl.videoWidth || 640;
    const H = videoEl.videoHeight || 480;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = W;
    tempCanvas.height = H;
    const ctx = tempCanvas.getContext('2d');

    // Draw video frame
    ctx.drawImage(videoEl, 0, 0, W, H);

    // Draw garment overlay (centered)
    if (garmentLoaded) {
      const img = document.querySelector('.buyer-ar-garment-img');
      if (img) {
        const scale = 0.6;
        const gW = W * scale;
        const gH = (img.naturalHeight / img.naturalWidth) * gW;
        const x = (W - gW) / 2;
        const y = H * 0.15;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, x, y, gW, gH);
        ctx.globalAlpha = 1.0;
      }
    }

    tempCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ar-try-on-${Date.now()}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/jpeg', 0.85);
  };

  return (
    <div className="buyer-ar-panel">
      <div className="buyer-ar-viewport" style={{ position: 'relative', minHeight: 200 }}>
        {/* Garment overlay image */}
        <img
          src={garmentUrl}
          alt="Garment overlay"
          className="buyer-ar-garment-img"
          crossOrigin="anonymous"
          onLoad={() => {
            setGarmentLoaded(true);
            setGarmentError(false);
            console.log('[BuyerARPanel] ✅ Garment image loaded:', garmentUrl);
          }}
          onError={() => {
            setGarmentError(true);
            console.warn('[BuyerARPanel] ❌ Failed to load garment:', garmentUrl);
          }}
          style={{
            position: 'absolute',
            top: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            opacity: garmentLoaded ? 0.85 : 0,
            zIndex: 10,
            pointerEvents: 'none',
            mixBlendMode: 'normal',
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* Status messages */}
        {!garmentLoaded && !garmentError && (
          <div className="buyer-ar-overlay-message">
            <div className="spinner" />
            <p>Loading garment overlay…</p>
          </div>
        )}

        {garmentError && (
          <div className="buyer-ar-overlay-message error">
            <p>❌ Failed to load garment image</p>
          </div>
        )}

        {garmentLoaded && (
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,200,100,0.85)',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            zIndex: 20,
          }}>
            ✨ AR Try-On Active
          </div>
        )}
      </div>

      {/* Screenshot button */}
      <button
        id="buyer-ar-screenshot-btn"
        className="buyer-ar-screenshot-btn"
        onClick={handleScreenshot}
        disabled={!garmentLoaded}
        aria-label="Capture AR try-on screenshot"
      >
        📷 Screenshot
      </button>
    </div>
  );
}
