import { useState, useEffect } from 'react';
import { useSessionState } from '../../context/SessionContext';

/**
 * BuyerARPanel — Hackathon demo
 * Shows garment image when received from seller.
 * Simple and visible — no MediaPipe pose detection.
 */
export default function BuyerARPanel({ videoRef }) {
  const { capturedGarmentUrl } = useSessionState();
  const [garmentLoaded, setGarmentLoaded] = useState(false);
  const [garmentError, setGarmentError] = useState(false);

  // Log every render for debugging
  useEffect(() => {
    console.log('[BuyerARPanel] capturedGarmentUrl:', capturedGarmentUrl);
  }, [capturedGarmentUrl]);

  // Reset states when URL changes
  useEffect(() => {
    setGarmentLoaded(false);
    setGarmentError(false);
  }, [capturedGarmentUrl]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
      borderRadius: 16,
      padding: 20,
      margin: '12px 0',
      border: '1px solid rgba(99,179,237,0.2)',
      color: '#e2e8f0',
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#90cdf4' }}>
        🎨 AR Try-On
      </h3>

      {!capturedGarmentUrl ? (
        <p style={{ color: '#718096', fontSize: 14, margin: 0 }}>
          ⏳ Waiting for seller to present a garment...
        </p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: '#90cdf4', margin: '0 0 8px', wordBreak: 'break-all' }}>
            Garment URL: {capturedGarmentUrl}
          </p>

          <div style={{
            position: 'relative',
            background: '#0f0f1a',
            borderRadius: 12,
            overflow: 'hidden',
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src={capturedGarmentUrl}
              alt="Garment"
              crossOrigin="anonymous"
              onLoad={() => {
                setGarmentLoaded(true);
                setGarmentError(false);
                console.log('[BuyerARPanel] ✅ Image loaded');
              }}
              onError={(e) => {
                setGarmentError(true);
                console.error('[BuyerARPanel] ❌ Image error:', e);
              }}
              style={{
                maxWidth: '80%',
                maxHeight: 300,
                objectFit: 'contain',
                display: garmentLoaded ? 'block' : 'none',
              }}
            />

            {!garmentLoaded && !garmentError && (
              <p style={{ color: '#90cdf4', fontSize: 14 }}>⏳ Loading image...</p>
            )}

            {garmentError && (
              <p style={{ color: '#fc8181', fontSize: 14 }}>
                ❌ Failed to load: {capturedGarmentUrl}
              </p>
            )}
          </div>

          {garmentLoaded && (
            <div style={{
              marginTop: 12,
              padding: '8px 16px',
              background: 'rgba(72, 187, 120, 0.2)',
              border: '1px solid rgba(72, 187, 120, 0.4)',
              borderRadius: 8,
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 600,
              color: '#68d391',
            }}>
              ✨ Garment loaded! AR overlay active
            </div>
          )}

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
              marginTop: 12,
              width: '100%',
              padding: '10px 20px',
              background: garmentLoaded ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: garmentLoaded ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 600,
              opacity: garmentLoaded ? 1 : 0.5,
            }}
          >
            📷 Take Screenshot
          </button>
        </>
      )}
    </div>
  );
}
