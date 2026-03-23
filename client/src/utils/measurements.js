/**
 * Pixel-to-cm conversion utilities.
 * Used by Track A (garment dimensions from seller frame)
 * and Track B (buyer body measurements).
 */

import { AR_CONFIG } from '../config/arConfig';

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
