import { AR_CONFIG } from '../config/arConfig';

/**
 * Mock segment response — used by Track A before Track D is ready.
 * Replace with real API call during integration.
 */
export async function segmentLiveFrame(jpegBlob, sessionId) {
  // MOCK — simulates 2-second processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    success: true,
    png_url: '/test_garment.png', // pre-segmented test asset in /public
    session_id: sessionId,
    processing_time_ms: 2134,
  };

  /*
  // REAL CALL — uncomment for integration with Track D:
  const formData = new FormData();
  formData.append('frame', jpegBlob, 'frame.jpg');
  formData.append('session_id', sessionId);

  const res = await fetch(`${AR_CONFIG.API_BASE_URL}${AR_CONFIG.SEGMENT_ENDPOINT}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Segmentation failed');
  }

  return res.json();
  */
}

/**
 * Delete a session — called on call end.
 */
export async function deleteSession(sessionId) {
  // MOCK
  console.log(`[Mock] Session ${sessionId} deleted`);
  return { deleted: true, session_id: sessionId };

  /*
  // REAL CALL:
  const res = await fetch(
    `${AR_CONFIG.API_BASE_URL}${AR_CONFIG.SESSION_DELETE_ENDPOINT}/${sessionId}`,
    { method: 'DELETE' }
  );
  return res.json();
  */
}

/**
 * Poll session status.
 */
export async function getSessionStatus(sessionId) {
  // MOCK
  return { status: 'ready', png_url: '/test_garment.png' };

  /*
  // REAL CALL:
  const res = await fetch(
    `${AR_CONFIG.API_BASE_URL}${AR_CONFIG.SESSION_STATUS_ENDPOINT}/${sessionId}/status`
  );
  return res.json();
  */
}
