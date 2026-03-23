import { useState, useEffect } from 'react';
import { useSessionState } from '../../context/SessionContext';

/**
 * BuyerARPanel — Renders INSIDE the ar-video-container as an absolute overlay.
 * Shows the segmented garment positioned on the buyer's live video feed.
 */
export default function BuyerARPanel({ videoRef }) {
  const { capturedGarmentUrl } = useSessionState();
  const [garmentLoaded, setGarmentLoaded] = useState(false);
  const [garmentError, setGarmentError] = useState(false);
  const [garmentScale, setGarmentScale] = useState(60); // percentage of container width

  console.log('[BuyerARPanel] capturedGarmentUrl:', capturedGarmentUrl);

  useEffect(() => {
    setGarmentLoaded(false);
    setGarmentError(false);
  }, [capturedGarmentUrl]);

  if (!capturedGarmentUrl) {
    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', color: '#90cdf4', fontSize: 14,
      }}>
        ⏳ Waiting for garment...
      </div>
    );
  }

  return (
    <>
      {/* Garment image overlay — positioned on buyer's torso area */}
      <img
        src={capturedGarmentUrl}
        alt="Garment overlay"
        crossOrigin="anonymous"
        onLoad={() => {
          setGarmentLoaded(true);
          setGarmentError(false);
          console.log('[BuyerARPanel] ✅ Garment loaded');
        }}
        onError={() => {
          setGarmentError(true);
          console.warn('[BuyerARPanel] ❌ Garment load failed:', capturedGarmentUrl);
        }}
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: `${garmentScale}%`,
          opacity: garmentLoaded ? 0.8 : 0,
          zIndex: 15,
          pointerEvents: 'none',
          mixBlendMode: 'normal',
          transition: 'opacity 0.3s ease, width 0.2s ease',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
        }}
      />

      {/* Loading state */}
      {!garmentLoaded && !garmentError && (
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 20, color: '#90cdf4', fontSize: 14, textAlign: 'center',
          background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: 8,
        }}>
          ⏳ Loading garment...
        </div>
      )}

      {/* Error state */}
      {garmentError && (
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 20, color: '#fc8181', fontSize: 14, textAlign: 'center',
          background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: 8,
        }}>
          ❌ Failed to load garment
        </div>
      )}

      {/* Status badge */}
      {garmentLoaded && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, background: 'rgba(72, 187, 120, 0.9)', color: '#fff',
          padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          ✨ AR Try-On Active
        </div>
      )}

      {/* Size adjustment slider */}
      {garmentLoaded && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 8,
          color: '#e2e8f0', fontSize: 11,
        }}>
          <span>Size</span>
          <input
            type="range"
            min={30}
            max={90}
            value={garmentScale}
            onChange={(e) => setGarmentScale(Number(e.target.value))}
            style={{ width: 80, cursor: 'pointer' }}
          />
        </div>
      )}

      {/* Screenshot button */}
      <button
        onClick={() => {
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

          // Draw garment on composite
          const img = container.querySelector('img[alt="Garment overlay"]');
          if (img && garmentLoaded) {
            const scale = garmentScale / 100;
            const gW = W * scale;
            const gH = (img.naturalHeight / img.naturalWidth) * gW;
            const x = (W - gW) / 2;
            const y = H * 0.15;
            ctx.globalAlpha = 0.8;
            ctx.drawImage(img, x, y, gW, gH);
            ctx.globalAlpha = 1.0;
          }

          c.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ar-try-on-${Date.now()}.jpg`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }, 'image/jpeg', 0.85);
        }}
        disabled={!garmentLoaded}
        style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 20,
          padding: '6px 14px',
          background: garmentLoaded ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(0,0,0,0.4)',
          color: '#fff', border: 'none', borderRadius: 8,
          cursor: garmentLoaded ? 'pointer' : 'not-allowed',
          fontSize: 12, fontWeight: 600,
          opacity: garmentLoaded ? 1 : 0.5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        📷 Screenshot
      </button>
    </>
  );
}
