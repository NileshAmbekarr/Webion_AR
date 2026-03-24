/**
 * Pixel-to-cm conversion utilities.
 * Used by Track A (garment dimensions from seller frame)
 * and Track B (buyer body measurements).
 */

import { AR_CONFIG } from '../config/arConfig';

/**
 * Compute buyer body measurements from MediaPipe pose keypoints.
 *
 * Instead of blindly scaling the garment, we compute the buyer's actual
 * body box in pixels and use it to stretch the garment precisely:
 *   - shoulderWidth_px : left-shoulder → right-shoulder
 *   - hipWidth_px      : left-hip      → right-hip
 *   - torsoHeight_px   : shoulder-midpoint → hip-midpoint
 *   - midShoulder      : { x, y } center of shoulder line
 *   - midHip           : { x, y } center of hip line
 *
 * NOTE: X is flipped (1 - kp.x) to match Agora's mirrored front-facing video.
 *
 * @param {Array}  keypoints - smoothed MediaPipe NormalizedLandmarkList
 * @param {number} W         - canvas/video width in pixels
 * @param {number} H         - canvas/video height in pixels
 * @returns {{ shoulderWidth_px, hipWidth_px, torsoHeight_px, midShoulder, midHip }}
 */
export function computeBuyerBodyBox(keypoints, W, H) {
  const kp = keypoints;

  // Pixel coordinates — X flipped to undo Agora's mirror
  const LS = { x: (1 - kp[11].x) * W, y: kp[11].y * H }; // left  shoulder
  const RS = { x: (1 - kp[12].x) * W, y: kp[12].y * H }; // right shoulder
  const LH = { x: (1 - kp[23].x) * W, y: kp[23].y * H }; // left  hip
  const RH = { x: (1 - kp[24].x) * W, y: kp[24].y * H }; // right hip

  const shoulderWidth_px = Math.hypot(LS.x - RS.x, LS.y - RS.y);
  const hipWidth_px      = Math.hypot(LH.x - RH.x, LH.y - RH.y);

  const midShoulder = { x: (LS.x + RS.x) / 2, y: (LS.y + RS.y) / 2 };
  const midHip      = { x: (LH.x + RH.x) / 2, y: (LH.y + RH.y) / 2 };

  const torsoHeight_px = Math.abs(midHip.y - midShoulder.y);

  return { shoulderWidth_px, hipWidth_px, torsoHeight_px, midShoulder, midHip };
}

/**
 * Estimate garment dimensions from mannequin keypoints.
 * Uses known average mannequin shoulder width as reference.
 *
 * @param {Object} keypoints - MediaPipe pose landmarks
 * @param {number} frameWidth - Video frame width in pixels
 * @param {number} frameHeight - Video frame height in pixels
 * @param {Object} garmentBBox - { x, y, width, height } bounding box of garment in pixels
 * @param {number} mannequinShoulderCm - Known mannequin shoulder width (default 36cm)
 * @returns {{ shoulderCm: number, chestCm: number, lengthCm: number }}
 */
export function estimateGarmentDimensions(keypoints, frameWidth, frameHeight, garmentBBox, mannequinShoulderCm = 36) {
  const ls = keypoints[11]; // LEFT_SHOULDER
  const rs = keypoints[12]; // RIGHT_SHOULDER

  // Calculate mannequin shoulder width in pixels
  const shoulderPx = Math.hypot(
    (ls.x - rs.x) * frameWidth,
    (ls.y - rs.y) * frameHeight
  );

  // px-per-cm ratio from known mannequin shoulder
  const pxPerCm = shoulderPx / mannequinShoulderCm;

  return {
    shoulderCm: Math.round(garmentBBox.width / pxPerCm),
    chestCm: Math.round((garmentBBox.width * 0.95) / pxPerCm), // chest ~95% of garment width
    lengthCm: Math.round(garmentBBox.height / pxPerCm),
  };
}

/**
 * Calculate distance between two keypoints in pixels.
 * @param {Object} kp1 - { x, y } normalized (0-1)
 * @param {Object} kp2 - { x, y } normalized (0-1)
 * @param {number} frameWidth
 * @param {number} frameHeight
 * @returns {number} distance in pixels
 */
export function keypointDistance(kp1, kp2, frameWidth, frameHeight) {
  return Math.hypot(
    (kp1.x - kp2.x) * frameWidth,
    (kp1.y - kp2.y) * frameHeight
  );
}
