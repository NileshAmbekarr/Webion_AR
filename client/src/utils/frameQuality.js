/**
 * Frame Quality Utilities
 * Pure functions for image analysis. Used by Track A (useFrameCapture).
 */

/**
 * Calculate sharpness of an image region.
 * Uses mean absolute pixel difference between adjacent pixels as a blur proxy.
 * @param {ImageData} imageData - Canvas ImageData
 * @param {number} cropSize - Size of center crop to analyze (default 50)
 * @returns {number} sharpness score (higher = sharper)
 */
export function calculateSharpness(imageData, cropSize = 50) {
  const { data, width, height } = imageData;
  const startX = Math.floor((width - cropSize) / 2);
  const startY = Math.floor((height - cropSize) / 2);

  let totalDiff = 0;
  let count = 0;

  for (let y = startY; y < startY + cropSize && y < height; y++) {
    for (let x = startX + 1; x < startX + cropSize && x < width; x++) {
      const idx = (y * width + x) * 4;
      const prevIdx = (y * width + (x - 1)) * 4;

      const diff = (
        Math.abs(data[idx] - data[prevIdx]) +
        Math.abs(data[idx + 1] - data[prevIdx + 1]) +
        Math.abs(data[idx + 2] - data[prevIdx + 2])
      ) / 3;

      totalDiff += diff;
      count++;
    }
  }

  return count > 0 ? totalDiff / count : 0;
}

/**
 * Calculate average luminance of the full frame.
 * Uses standard luminance formula: 0.299R + 0.587G + 0.114B
 * @param {ImageData} imageData - Canvas ImageData
 * @returns {number} luminance (0–255)
 */
export function calculateLuminance(imageData) {
  const { data } = imageData;
  let totalLum = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    totalLum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }

  return pixelCount > 0 ? totalLum / pixelCount : 0;
}

/**
 * Calculate mean absolute difference between two frames (stability proxy).
 * @param {ImageData} frame1 - Previous frame
 * @param {ImageData} frame2 - Current frame
 * @param {number} cropSize - Size of center crop to compare (default 100)
 * @returns {number} mean diff (0–255). Lower = more stable.
 */
export function calculateFrameDelta(frame1, frame2, cropSize = 100) {
  if (frame1.width !== frame2.width || frame1.height !== frame2.height) return 255;

  const { width, height } = frame1;
  const startX = Math.floor((width - cropSize) / 2);
  const startY = Math.floor((height - cropSize) / 2);

  let totalDiff = 0;
  let count = 0;

  for (let y = startY; y < startY + cropSize && y < height; y++) {
    for (let x = startX; x < startX + cropSize && x < width; x++) {
      const idx = (y * width + x) * 4;
      const diff = (
        Math.abs(frame1.data[idx] - frame2.data[idx]) +
        Math.abs(frame1.data[idx + 1] - frame2.data[idx + 1]) +
        Math.abs(frame1.data[idx + 2] - frame2.data[idx + 2])
      ) / 3;

      totalDiff += diff;
      count++;
    }
  }

  return count > 0 ? totalDiff / count : 255;
}
