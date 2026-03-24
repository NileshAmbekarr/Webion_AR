import { useEffect, useRef, useCallback } from 'react';
import { AR_CONFIG } from '../config/arConfig';

const {
  GARMENT_SHOULDER_PADDING,
  GARMENT_X_OVERHANG,
  GARMENT_Y_NECKLINE,
  GARMENT_MAX_HEIGHT_RATIO,
  SHOULDER_Y_OFFSET,
} = AR_CONFIG;

/**
 * useGarmentOverlay — Track B
 * Renders the segmented garment PNG on the canvas, anchored to buyer's shoulders.
 *
 * @param {React.RefObject} canvasRef  — ref to overlay <canvas> element
 * @param {React.RefObject} videoRef   — ref to buyer <video> element
 * @param {Array|null}      keypoints  — smoothed MediaPipe NormalizedLandmarkList
 * @param {string|null}     garmentUrl — URL of segmented garment PNG
 *
 * Returns:
 *   screenshotFn — async function that captures composite (video + overlay) as JPEG
 */
export function useGarmentOverlay(canvasRef, videoRef, keypoints, garmentUrl) {
  const garmentImageRef = useRef(null);
  const rafRef = useRef(null);
  const activeRef = useRef(true);

  // --- Load garment image whenever garmentUrl changes ---
  useEffect(() => {
    if (!garmentUrl) {
      garmentImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      garmentImageRef.current = img;
    };
    img.onerror = () => {
      console.warn('[useGarmentOverlay] Failed to load garment image:', garmentUrl);
      garmentImageRef.current = null;
    };
    img.src = garmentUrl;
  }, [garmentUrl]);

  // --- Render loop ---
  useEffect(() => {
    activeRef.current = true;

    function renderFrame() {
      if (!activeRef.current) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video) {
        rafRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      // Keep canvas in sync with video dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || canvas.offsetWidth;
        canvas.height = video.videoHeight || canvas.offsetHeight;
      }

      const ctx = canvas.getContext('2d');
      const W = canvas.width;
      const H = canvas.height;

      // 1. Clear
      ctx.clearRect(0, 0, W, H);

      // 2. Skip if no keypoints
      const kp = keypoints;
      const garment = garmentImageRef.current;
      if (!kp || W === 0 || H === 0) {
        rafRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      // 3. Extract key pixel coordinates (flip X to match Agora's mirrored video)
      const LS = { x: (1 - kp[11].x) * W, y: kp[11].y * H };
      const RS = { x: (1 - kp[12].x) * W, y: kp[12].y * H };
      const LH = { x: (1 - kp[23].x) * W, y: kp[23].y * H };
      const RH = { x: (1 - kp[24].x) * W, y: kp[24].y * H };

      // 4. Shoulder width in px
      const shoulderWidth_px = Math.hypot(LS.x - RS.x, LS.y - RS.y);

      // 5. Torso center + hip center
      const midShoulder = { x: (LS.x + RS.x) / 2, y: (LS.y + RS.y) / 2 };
      const midHip = { x: (LH.x + RH.x) / 2, y: (LH.y + RH.y) / 2 };

      // 6. Shoulder-to-hip distance (torso height)
      const torsoHeight = Math.abs(midHip.y - midShoulder.y);

      // 7. Shift shoulder anchor UP to compensate for MediaPipe detecting joint center, not top of shoulder
      midShoulder.y -= torsoHeight * SHOULDER_Y_OFFSET;

      // ── Draw garment (only if loaded) ──
      if (garment) {
        const scaledWidth = shoulderWidth_px * GARMENT_SHOULDER_PADDING;
        let scaledHeight = garment.naturalHeight * (scaledWidth / garment.naturalWidth);

        // Clamp garment height to not extend too far below the hips
        const maxHeight = torsoHeight * GARMENT_MAX_HEIGHT_RATIO;
        if (scaledHeight > maxHeight && maxHeight > 0) {
          scaledHeight = maxHeight;
        }

        // Apply slight horizontal overhang for natural draping
        const xPos = midShoulder.x - scaledWidth / 2 - (shoulderWidth_px * GARMENT_X_OVERHANG);
        const yPos = midShoulder.y - scaledHeight * GARMENT_Y_NECKLINE;

        ctx.globalAlpha = 0.92;
        ctx.drawImage(garment, xPos, yPos, scaledWidth, scaledHeight);
        ctx.globalAlpha = 1.0;
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    }

    rafRef.current = requestAnimationFrame(renderFrame);

    return () => {
      activeRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Clear canvas on unmount
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [canvasRef, videoRef, keypoints]);

  // --- Screenshot function ---
  const screenshotFn = useCallback(() => {
    const video = videoRef.current;
    const overlayCanvas = canvasRef.current;

    if (!video || !overlayCanvas) {
      console.warn('[useGarmentOverlay] screenshotFn: refs not ready');
      return;
    }

    const W = video.videoWidth || video.offsetWidth;
    const H = video.videoHeight || video.offsetHeight;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = W;
    tempCanvas.height = H;
    const ctx = tempCanvas.getContext('2d');

    // 1. Draw video frame
    ctx.drawImage(video, 0, 0, W, H);

    // 2. Draw garment overlay on top
    ctx.drawImage(overlayCanvas, 0, 0, W, H);

    // 3. Export as JPEG blob
    tempCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);

        // Desktop: download link
        if (!navigator.share) {
          const a = document.createElement('a');
          a.href = url;
          a.download = `ar-try-on-${Date.now()}.jpg`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } else {
          // Mobile: Web Share API
          const file = new File([blob], `ar-try-on-${Date.now()}.jpg`, { type: 'image/jpeg' });
          navigator
            .share({ files: [file], title: 'AR Try-On Snapshot' })
            .then(() => URL.revokeObjectURL(url))
            .catch(() => {
              // Fallback: show download link
              const a = document.createElement('a');
              a.href = url;
              a.download = `ar-try-on-${Date.now()}.jpg`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 5000);
            });
        }
      },
      'image/jpeg',
      0.85
    );
  }, [canvasRef, videoRef]);

  return { screenshotFn };
}
