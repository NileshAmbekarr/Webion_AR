import { AR_CONFIG } from '../config/arConfig';

/**
 * Send a JPEG frame to the real backend for segmentation.
 * Falls back gracefully on errors.
 */
export async function segmentLiveFrame(jpegBlob, sessionId) {
  const formData = new FormData();
  formData.append('frame', jpegBlob, 'frame.jpg');
  formData.append('session_id', sessionId);

  const res = await fetch(`${AR_CONFIG.API_BASE_URL}${AR_CONFIG.SEGMENT_ENDPOINT}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || err.error || 'Segmentation failed');
  }

  return res.json();
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
  const res = await fetch(
    `${AR_CONFIG.API_BASE_URL}${AR_CONFIG.SESSION_STATUS_ENDPOINT}/${sessionId}/status`
  );
  return res.json();
}
