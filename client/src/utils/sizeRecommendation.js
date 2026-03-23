import { AR_CONFIG } from '../config/arConfig';

/**
 * Size Recommendation Utilities
 * Pure functions for fit badge logic. Used by Track B (SizeCard component).
 */

/**
 * Get fit recommendation based on garment vs buyer shoulder width.
 * @param {number} garmentShoulderCm - Garment shoulder width in cm
 * @returns {{ badge: string, message: string, color: string }}
 */
export function getFitRecommendation(garmentShoulderCm) {
  const diff = garmentShoulderCm - AR_CONFIG.ASSUMED_SHOULDER_CM;

  if (diff > AR_CONFIG.FIT_TOLERANCE_CM) {
    return {
      badge: 'LARGE',
      message: 'Garment runs large — consider sizing down',
      color: '#f59e0b', // amber
    };
  }

  if (diff < -AR_CONFIG.FIT_TOLERANCE_CM) {
    return {
      badge: 'SMALL',
      message: 'Garment runs small — consider sizing up',
      color: '#ef4444', // red
    };
  }

  return {
    badge: 'STANDARD',
    message: 'Standard fit for average build',
    color: '#22c55e', // green
  };
}

/**
 * Convert pixel measurements to approximate cm using buyer shoulder reference.
 * NOTE: Without depth data, this is an estimate only.
 * @param {number} pixelValue - Measurement in pixels
 * @param {number} buyerShoulderPx - Buyer's shoulder width in pixels
 * @returns {number} Approximate cm value
 */
export function pixelsToCm(pixelValue, buyerShoulderPx) {
  if (buyerShoulderPx <= 0) return 0;
  const pxPerCm = buyerShoulderPx / AR_CONFIG.ASSUMED_SHOULDER_CM;
  return Math.round(pixelValue / pxPerCm);
}
