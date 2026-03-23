import { useEffect, useRef, useState } from 'react';

/**
 * useCamera — Track B
 * Manages buyer's front camera stream.
 *
 * Returns:
 *   videoRef    — React ref attached to <video> element
 *   stream      — MediaStream | null
 *   isLoading   — boolean
 *   error       — 'denied' | 'not_supported' | null
 */
export function useCamera() {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let localStream = null;

    async function startCamera() {
      setIsLoading(true);
      setError(null);

      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) {
          // Component unmounted before we got the stream
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
          await videoRef.current.play().catch(() => {});
        }

        setStream(localStream);
        setIsLoading(false);
      } catch (err) {
        if (!active) return;
        setIsLoading(false);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('denied');
        } else {
          setError('not_supported');
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      // Also stop the currently tracked stream in state
      setStream((prev) => {
        if (prev) prev.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, []);

  return { videoRef, stream, isLoading, error };
}
