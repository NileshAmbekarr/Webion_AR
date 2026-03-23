import { useState, useEffect, useRef, useCallback } from 'react';
import { usePoseDetection } from '../../hooks/usePoseDetection';

/**
 * PoseLandmarkOverlay — Renders MediaPipe Pose body landmarks
 * on the buyer's video feed. Shows immediately on join, no AR state needed.
 */
export default function PoseLandmarkOverlay({ videoRef }) {
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
      }
    };
    findVideo();
    const timer = setInterval(findVideo, 500);
    return () => clearInterval(timer);
  }, [videoRef]);

  // MediaPipe Pose
  const { keypoints, isModelLoaded, fps } = usePoseDetection(videoElRef, true);

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
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke();
    }

    // Draw keypoint dots
    for (let i = 0; i < Math.min(kp.length, 33); i++) {
      const px = kp[i].x * W;
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
      const mx = ((kp[11].x + kp[12].x) / 2) * W;
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

      {/* Status badge */}
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
    </>
  );
}
