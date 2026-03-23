import { AR_CONFIG } from '../config/arConfig';

/**
 * Send a JPEG frame for segmentation.
 * Tries the real backend first, falls back to mock if it fails.
 */
export async function segmentLiveFrame(jpegBlob, sessionId) {
  const url = `${AR_CONFIG.API_BASE_URL}${AR_CONFIG.SEGMENT_ENDPOINT}`;
  console.log(`[segmentApi] 📤 Sending frame to ${url} (${(jpegBlob.size / 1024).toFixed(1)}KB, session=${sessionId})`);

  // Try real API first
  try {
    const formData = new FormData();
    formData.append('frame', jpegBlob, 'frame.jpg');
    formData.append('session_id', sessionId);

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    console.log(`[segmentApi] Response status: ${res.status}`);
    const data = await res.json();
    console.log('[segmentApi] Response body:', data);

    if (res.ok && data.success) {
      // Build the full URL for backend-served files
      let pngUrl = data.png_url;
      if (pngUrl && pngUrl.startsWith('/ar-temp/')) {
        pngUrl = `${AR_CONFIG.API_BASE_URL}${pngUrl}`;
      }
      console.log('[segmentApi] ✅ Real API success:', pngUrl);
      return { ...data, png_url: pngUrl };
    }
    console.warn('[segmentApi] Real API returned failure:', data);
  } catch (e) {
    console.warn('[segmentApi] Real API error:', e.message);
  }

  // MOCK fallback — simulates 1-second processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    success: true,
    png_url: '/test_garment.png',
    session_id: sessionId,
    processing_time_ms: 1000,
  };
}

/**
 * Delete a session — called on call end.
 */
export async function deleteSession(sessionId) {
  try {
    const res = await fetch(
      `${AR_CONFIG.API_BASE_URL}${AR_CONFIG.SESSION_DELETE_ENDPOINT}/${sessionId}`,
      { method: 'DELETE' }
    );
    return res.json();
  } catch (e) {
    console.warn('[segmentApi] Failed to delete session:', e);
    return { deleted: false };
  }
}

/**
 * Poll session status.
 */
export async function getSessionStatus(sessionId) {
  try {
    const res = await fetch(
      `${AR_CONFIG.API_BASE_URL}${AR_CONFIG.SESSION_STATUS_ENDPOINT}/${sessionId}/status`
    );
    return res.json();
  } catch (e) {
    return { status: 'ready', png_url: '/test_garment.png' };
  }
}
