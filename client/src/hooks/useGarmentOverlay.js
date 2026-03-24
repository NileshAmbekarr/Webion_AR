import { useEffect, useRef, useCallback } from 'react';
import { AR_CONFIG } from '../config/arConfig';

/**
 * useGarmentOverlay — Track B (Measurement-Based Fitting)
 *
 * Renders the segmented garment PNG on the canvas, stretched to match the
 * buyer's actual body measurements derived from MediaPipe pose keypoints:
 *
 *   draw-width  = shoulder_px  × GARMENT_SHOULDER_SCALE  (covers shoulder + sleeve room)
 *   draw-height = torso_px     × GARMENT_TORSO_SCALE     (covers shoulder-to-hip + hem drape)
 *
 * Width and height are INDEPENDENT — the garment morphs to the buyer's
 * body proportions instead of being locked to its original aspect ratio.
 *
 * @param {React.RefObject} canvasRef  — ref to overlay <canvas> element
 * @param {React.RefObject} videoRef   — ref to buyer <video> element
 * @param {Array|null}      keypoints  — smoothed MediaPipe NormalizedLandmarkList
 * @param {string|null}     garmentUrl — URL of segmented garment PNG
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

      // 2. Skip if no keypoints or canvas not ready
      const kp = keypoints;
      const garment = garmentImageRef.current;
      if (!kp || W === 0 || H === 0) {
        rafRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // 3. BODY MEASUREMENT — compute buyer's body box in pixels
      //
      //    X is flipped (1 - kp.x) to undo Agora's mirrored video.
      //    This gives real left/right positions on screen.
      // ─────────────────────────────────────────────────────────────
      const LS = { x: (1 - kp[11].x) * W, y: kp[11].y * H }; // left  shoulder
      const RS = { x: (1 - kp[12].x) * W, y: kp[12].y * H }; // right shoulder
      const LH = { x: (1 - kp[23].x) * W, y: kp[23].y * H }; // left  hip
      const RH = { x: (1 - kp[24].x) * W, y: kp[24].y * H }; // right hip

      // Shoulder width in pixels (actual measured body width)
      const shoulderWidth_px = Math.hypot(LS.x - RS.x, LS.y - RS.y);

      // Torso centre points
      const midShoulder = { x: (LS.x + RS.x) / 2, y: (LS.y + RS.y) / 2 };
      const midHip      = { x: (LH.x + RH.x) / 2, y: (LH.y + RH.y) / 2 };

      // Torso height in pixels — shoulder midpoint → hip midpoint
      const torsoHeight_px = Math.abs(midHip.y - midShoulder.y);

      // Guard: skip if measurements are degenerate (buyer too far/partial)
      if (shoulderWidth_px < 10 || torsoHeight_px < 10) {
        rafRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // 4. MEASUREMENT-BASED GARMENT SIZING
      //
      //    Width  = shoulder_px × GARMENT_SHOULDER_SCALE
      //    Height = torso_px    × GARMENT_TORSO_SCALE
      //
      //    These are INDEPENDENT — the garment image is stretched both
      //    horizontally and vertically to match the buyer's body box.
      //    A tall buyer gets a taller garment; a wide buyer gets a wider
      //    garment — regardless of the garment's original aspect ratio.
      // ─────────────────────────────────────────────────────────────
      const {
        GARMENT_SHOULDER_SCALE,
        GARMENT_TORSO_SCALE,
        GARMENT_NECK_OFFSET,
        SHOULDER_Y_OFFSET,
      } = AR_CONFIG;

      const drawWidth  = shoulderWidth_px * GARMENT_SHOULDER_SCALE;
      const drawHeight = torsoHeight_px   * GARMENT_TORSO_SCALE;

      // ─────────────────────────────────────────────────────────────
      // 5. ANCHOR POSITION
      //
      //    MediaPipe reports the *joint centre*, not the top of shoulder.
      //    Shift anchor UP by SHOULDER_Y_OFFSET so the overlay starts at
      //    approximately the actual shoulder-top / collar line.
      //    Then shift top of garment UP by GARMENT_NECK_OFFSET for collar.
      // ─────────────────────────────────────────────────────────────
      const anchorY = midShoulder.y - torsoHeight_px * SHOULDER_Y_OFFSET;
      const xPos    = midShoulder.x - drawWidth / 2;
      const yPos    = anchorY - torsoHeight_px * GARMENT_NECK_OFFSET;

      // 6. Draw garment: stretched independently in both axes to match body box
      if (garment) {
        ctx.globalAlpha = 0.92;
        ctx.drawImage(garment, xPos, yPos, drawWidth, drawHeight);
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
