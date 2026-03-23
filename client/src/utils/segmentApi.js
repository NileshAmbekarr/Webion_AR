import { AR_CONFIG } from '../config/arConfig';

/**
 * Send a JPEG frame for segmentation via the real backend.
 * NO MOCK FALLBACK — if the API fails, it returns an error.
 */
export async function segmentLiveFrame(jpegBlob, sessionId) {
  const url = `${AR_CONFIG.API_BASE_URL}${AR_CONFIG.SEGMENT_ENDPOINT}`;
  console.log(`[segmentApi] 📤 Sending frame to ${url} (${(jpegBlob.size / 1024).toFixed(1)}KB, session=${sessionId})`);

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
      // Build full URL for backend-served files
      let pngUrl = data.png_url;
      if (pngUrl && pngUrl.startsWith('/ar-temp/')) {
        pngUrl = `${AR_CONFIG.API_BASE_URL}${pngUrl}`;
      }
      console.log('[segmentApi] ✅ Real segmentation success:', pngUrl);
      return { ...data, png_url: pngUrl };
    }

    // API returned an error
    console.error('[segmentApi] ❌ API returned failure:', data);
    return {
      success: false,
      error: data.error || 'Segmentation failed',
      message: data.message || 'Unknown error',
    };
  } catch (e) {
    console.error('[segmentApi] ❌ API call failed:', e.message);
    return {
      success: false,
      error: 'API unreachable',
      message: e.message,
    };
  }
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
    return { status: 'unknown', error: e.message };
  }
}
