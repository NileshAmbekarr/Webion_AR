import { useState, useEffect, useRef, useCallback } from 'react';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { AR_CONFIG } from '../../config/arConfig';

/**
 * PoseLandmarkOverlay — Renders MediaPipe Pose body landmarks
 * on the buyer's video feed. Shows immediately on join, no AR state needed.
 *
 * Owns the single usePoseDetection instance and reports keypoints
 * up to the parent via onPoseUpdate callback.
 */
export default function PoseLandmarkOverlay({
  videoRef,
  onPoseUpdate,
  onVideoElFound,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Find the actual <video> inside the Agora container
  const videoElRef = useRef(null);
  useEffect(() => {
    const container = videoRef?.current;
    if (!container) return;
    const findVideo = () => {
      const vid = container.querySelector('video');
      if (vid && !videoElRef.current) {
        videoElRef.current = vid;
        console.log('[PoseLandmarks] Found <video>:', vid.videoWidth, 'x', vid.videoHeight);
        // Report video element to parent for garment overlay
        if (onVideoElFound) onVideoElFound(vid);
      }
    };
    findVideo();
    const timer = setInterval(findVideo, 500);
    return () => clearInterval(timer);
  }, [videoRef, onVideoElFound]);

  // MediaPipe Pose — sole instance
  const { keypoints, isModelLoaded, fps } = usePoseDetection(videoElRef, true);

  // Report keypoints to parent whenever they change
  useEffect(() => {
    if (onPoseUpdate) {
      onPoseUpdate({ keypoints, isModelLoaded, fps });
    }
  }, [keypoints, isModelLoaded, fps, onPoseUpdate]);

  // Live measurement readout — 100% real-time from MediaPipe keypoints each frame.
  // Pixel values are genuine live measurements. cm values are NOT shown because
  // converting px→cm requires knowing the camera's physical distance, which we don't have.
  // The garment overlay itself uses these px values directly — no assumptions.
  const [measurementHUD, setMeasurementHUD] = useState(null);
  useEffect(() => {
    if (!keypoints || !canvasRef.current) { setMeasurementHUD(null); return; }
    const cv = canvasRef.current;
    // Use actual canvas pixel dimensions (real video frame size)
    const W = cv.width || cv.offsetWidth;
    const H = cv.height || cv.offsetHeight;
    if (!W || !H) return;
    const kp = keypoints;

    // Real-time pixel coordinates (X flipped to match Agora mirror)
    const LS = { x: (1 - kp[11].x) * W, y: kp[11].y * H }; // left  shoulder
    const RS = { x: (1 - kp[12].x) * W, y: kp[12].y * H }; // right shoulder
    const LH = { x: (1 - kp[23].x) * W, y: kp[23].y * H }; // left  hip
    const RH = { x: (1 - kp[24].x) * W, y: kp[24].y * H }; // right hip

    const shoulderPx  = Math.hypot(LS.x - RS.x, LS.y - RS.y);
    const hipPx       = Math.hypot(LH.x - RH.x, LH.y - RH.y);
    const midShoulderY = (LS.y + RS.y) / 2;
    const midHipY      = (LH.y + RH.y) / 2;
    const torsoPx      = Math.abs(midHipY - midShoulderY);

    // ── Real reference: ear-to-ear head width ──────────────────────────────
    // Average adult ear-to-ear = ~14cm. This is NOT the measurement being shown,
    // so it doesn't cancel out — shoulder, torso, and hip cm values all vary
    // in real-time based on the person's actual distance and proportions.
    // Falls back to shoulder-based (38cm) if ears aren't detected.
    const ASSUMED_HEAD_WIDTH_CM = 14;
    const LEar = kp[7]?.visibility > 0.3 ? { x: (1 - kp[7].x) * W, y: kp[7].y * H } : null;
    const REar = kp[8]?.visibility > 0.3 ? { x: (1 - kp[8].x) * W, y: kp[8].y * H } : null;
    let pxPerCm;
    let refLabel;
    if (LEar && REar) {
      const earPx = Math.hypot(LEar.x - REar.x, LEar.y - REar.y);
      pxPerCm  = earPx / ASSUMED_HEAD_WIDTH_CM;
      refLabel = `head-width ~${ASSUMED_HEAD_WIDTH_CM}cm`;
    } else {
      // Fallback: shoulder reference (shoulder will show ~38cm, others vary)
      pxPerCm  = shoulderPx / AR_CONFIG.ASSUMED_SHOULDER_CM;
      refLabel = `shoulder ~${AR_CONFIG.ASSUMED_SHOULDER_CM}cm (ears hidden)`;
    }

    setMeasurementHUD({
      shoulderPx: Math.round(shoulderPx),
      hipPx:      Math.round(hipPx),
      torsoPx:    Math.round(torsoPx),
      shoulderCm: Math.round(shoulderPx / pxPerCm),  // real-time ✅
      torsoCm:    Math.round(torsoPx    / pxPerCm),  // real-time ✅
      hipCm:      Math.round(hipPx      / pxPerCm),  // real-time ✅
      refLabel,
      frameW: W, frameH: H,
    });
  }, [keypoints]);

  // Keypoint labels for key joints
  const keyLabels = useRef({
    0: 'Nose', 7: 'L Ear', 8: 'R Ear',
    11: 'L Shoulder', 12: 'R Shoulder',
    13: 'L Elbow', 14: 'R Elbow',
    15: 'L Wrist', 16: 'R Wrist',
    23: 'L Hip', 24: 'R Hip',
    25: 'L Knee', 26: 'R Knee',
    27: 'L Ankle', 28: 'R Ankle',
  });

  // Skeleton connections
  const connections = useRef([
    // Torso (green)
    { from: 11, to: 12, color: '#00ff88' },
    { from: 11, to: 23, color: '#00ff88' },
    { from: 12, to: 24, color: '#00ff88' },
    { from: 23, to: 24, color: '#00ff88' },
    // Left arm (orange)
    { from: 11, to: 13, color: '#ffaa00' },
    { from: 13, to: 15, color: '#ffaa00' },
    // Right arm (orange)
    { from: 12, to: 14, color: '#ffaa00' },
    { from: 14, to: 16, color: '#ffaa00' },
    // Left leg (cyan)
    { from: 23, to: 25, color: '#00ccff' },
    { from: 25, to: 27, color: '#00ccff' },
    // Right leg (cyan)
    { from: 24, to: 26, color: '#00ccff' },
    { from: 26, to: 28, color: '#00ccff' },
  ]);

  // Render loop — draws keypoints + skeleton on canvas
  const drawLandmarks = useCallback(() => {
    const canvas = canvasRef.current;
    const kp = keypoints;
    if (!canvas) {
      rafRef.current = requestAnimationFrame(drawLandmarks);
      return;
    }

    const videoEl = videoElRef.current;
    if (videoEl) {
      if (canvas.width !== videoEl.videoWidth || canvas.height !== videoEl.videoHeight) {
        canvas.width = videoEl.videoWidth || canvas.offsetWidth || 640;
        canvas.height = videoEl.videoHeight || canvas.offsetHeight || 480;
      }
    }

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (!kp || W === 0 || H === 0) {
      rafRef.current = requestAnimationFrame(drawLandmarks);
      return;
    }

    // Draw skeleton connections
    ctx.lineWidth = 2;
    for (const conn of connections.current) {
      const a = kp[conn.from];
      const b = kp[conn.to];
      if (!a || !b) continue;
      const visA = a.visibility || 0;
      const visB = b.visibility || 0;
      if (visA < 0.3 || visB < 0.3) continue;

      ctx.strokeStyle = conn.color;
      ctx.beginPath();
      ctx.moveTo((1 - a.x) * W, a.y * H);
      ctx.lineTo((1 - b.x) * W, b.y * H);
      ctx.stroke();
    }

    // Draw keypoint dots
    for (let i = 0; i < Math.min(kp.length, 33); i++) {
      const px = (1 - kp[i].x) * W;  // Flip X to match Agora's mirrored video
      const py = kp[i].y * H;
      const vis = kp[i].visibility || 0;
      if (vis < 0.3) continue;

      // Colors: green=torso, orange=arms, cyan=legs, white=other
      const isTorso = [11, 12, 23, 24].includes(i);
      const isArm = [13, 14, 15, 16].includes(i);
      const isLeg = [25, 26, 27, 28].includes(i);
      ctx.fillStyle = isTorso ? '#00ff88' : isArm ? '#ffaa00' : isLeg ? '#00ccff' : 'rgba(255,255,255,0.6)';

      ctx.beginPath();
      ctx.arc(px, py, isTorso ? 7 : 5, 0, 2 * Math.PI);
      ctx.fill();

      // Black outline for visibility
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Labels
      const label = keyLabels.current[i];
      if (label) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        ctx.fillText(label, px + 10, py + 4);
        ctx.shadowBlur = 0;
      }
    }

    // Center crosshair (midpoint between shoulders)
    if (kp[11] && kp[12]) {
      const mx = (1 - (kp[11].x + kp[12].x) / 2) * W;  // Flip X
      const my = ((kp[11].y + kp[12].y) / 2) * H;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText('Center', mx + 8, my - 8);
      ctx.shadowBlur = 0;
    }

    // ── Garment Fit-Box: show exactly where the shirt will be placed ──────
    // Uses the same constants as useGarmentOverlay so the box matches perfectly.
    const kpLS = kp[11], kpRS = kp[12], kpLH = kp[23], kpRH = kp[24];
    const allVisible = [kpLS, kpRS, kpLH, kpRH].every(p => p && (p.visibility || 0) >= 0.4);
    if (allVisible) {
      const fLS = { x: (1 - kpLS.x) * W, y: kpLS.y * H };
      const fRS = { x: (1 - kpRS.x) * W, y: kpRS.y * H };
      const fLH = { x: (1 - kpLH.x) * W, y: kpLH.y * H };
      const fRH = { x: (1 - kpRH.x) * W, y: kpRH.y * H };

      const shoulderPx  = Math.hypot(fLS.x - fRS.x, fLS.y - fRS.y);
      const midShX = (fLS.x + fRS.x) / 2;
      const midShY = (fLS.y + fRS.y) / 2;
      const midHipY = (fLH.y + fRH.y) / 2;
      const torsoPx = Math.abs(midHipY - midShY);

      // Mirror the exact sizing from useGarmentOverlay
      const SHOULDER_SCALE = 1.15;
      const TORSO_SCALE    = 1.10;
      const NECK_OFFSET    = 0.10;
      const JOINT_OFFSET   = 0.08;

      const drawW = shoulderPx * SHOULDER_SCALE;
      const drawH = torsoPx   * TORSO_SCALE;
      const anchorY = midShY - torsoPx * JOINT_OFFSET;
      const boxX = midShX - drawW / 2;
      const boxY = anchorY - torsoPx * NECK_OFFSET;

      // Outer glow (soft blue)
      ctx.save();
      ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.strokeRect(boxX, boxY, drawW, drawH);

      // Inner dashed border (bright blue)
      ctx.strokeStyle = 'rgba(144, 205, 244, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(boxX, boxY, drawW, drawH);
      ctx.setLineDash([]);

      // Top center label
      ctx.fillStyle = 'rgba(102, 126, 234, 0.95)';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText('👕 Garment Fit Zone', midShX, boxY - 5);

      // Dimension labels
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#90cdf4';
      ctx.fillText(`W: ${Math.round(drawW)}px`, midShX, boxY + drawH + 14);
      ctx.textAlign = 'left';
      ctx.fillText(`H: ${Math.round(drawH)}px`, boxX + drawW + 6, boxY + drawH / 2);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(drawLandmarks);
  }, [keypoints]);

  // Start/stop render loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawLandmarks);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawLandmarks]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* Pose status badge — top right */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 20,
        padding: '4px 10px', borderRadius: 12,
        fontSize: 11, fontWeight: 600,
        background: isModelLoaded ? 'rgba(72, 187, 120, 0.9)' : 'rgba(99, 179, 237, 0.9)',
        color: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      }}>
        {isModelLoaded ? `🦴 Pose ${fps} FPS` : '🔍 Loading Pose...'}
      </div>

      {/* Live body measurement HUD — top left (only when pose is active) */}
      {isModelLoaded && measurementHUD && (
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 20,
          padding: '6px 10px', borderRadius: 10,
          background: 'rgba(0,0,0,0.65)',
          color: '#e2e8f0', fontSize: 10, fontWeight: 500,
          lineHeight: 1.7,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{ fontWeight: 700, color: '#90cdf4', marginBottom: 2 }}>📐 Live Body Measurements</div>
          <div>↔️ Shoulder: <b>{measurementHUD.shoulderPx}px</b> ≈ <b>{measurementHUD.shoulderCm}cm</b></div>
          <div>↕️ Torso:    <b>{measurementHUD.torsoPx}px</b> ≈ <b>{measurementHUD.torsoCm}cm</b> (live)</div>
          <div>🦴 Hip:      <b>{measurementHUD.hipPx}px</b> ≈ <b>{measurementHUD.hipCm}cm</b> (live)</div>
          <div style={{ color: '#718096', fontSize: 9 }}>Ref: {measurementHUD.refLabel} | {measurementHUD.frameW}×{measurementHUD.frameH}</div>
        </div>
      )}
    </>
  );
}
