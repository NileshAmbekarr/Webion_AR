import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { v4 as uuidv4 } from 'uuid';
import { SessionProvider, useSessionState, SESSION_STATES } from '../../context/SessionContext';
import { AR_CONFIG } from '../../config/arConfig';
import { useFrameCapture } from '../../hooks/useFrameCapture';
import SellerCapturePanel from './SellerCapturePanel';
import SessionStatusBanner from './SessionStatusBanner';
import ConsentModal from './ConsentModal';
import BuyerARPanel from './BuyerARPanel';
import './ar.css';

/**
 * ARSessionPanel — Main container for the AR session.
 * Manages Agora video call and coordinates seller/buyer panels.
 *
 * In the hackathon demo, both seller and buyer run in the same browser
 * (or separate tabs/devices). This component handles a SINGLE role
 * based on the `role` prop.
 */
function ARSessionPanelInner({ role = 'seller' }) {
  const {
    sessionId, setSessionId,
    sessionState, transitionTo,
    setCapturedGarmentUrl,
    endSession,
    error,
    rtmChannelRef,
  } = useSessionState();

  // Agora state
  const [client] = useState(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [joined, setJoined] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [channelName, setChannelName] = useState('');
  const [inputChannel, setInputChannel] = useState('webion-ar-demo');
  const [isJoining, setIsJoining] = useState(false);

  // Video refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Frame capture (seller side)
  const isCapturing = [
    SESSION_STATES.SELLER_PREPARING,
    SESSION_STATES.SCANNING,
    SESSION_STATES.COUNTING_DOWN,
  ].includes(sessionState);

  const handleCaptureComplete = useCallback((result) => {
    const fullUrl = result.png_url.startsWith('http')
      ? result.png_url
      : `${AR_CONFIG.API_BASE_URL}${result.png_url}`;
    setCapturedGarmentUrl(fullUrl);
    transitionTo(SESSION_STATES.AR_ACTIVE, { garmentUrl: fullUrl });
  }, [setCapturedGarmentUrl, transitionTo]);

  const handleCaptureError = useCallback((errMsg) => {
    transitionTo(SESSION_STATES.ERROR, { error: errMsg });
  }, [transitionTo]);

  const captureData = useFrameCapture(
    localVideoRef,    // Seller's own camera (pointing at mannequin)
    isCapturing,
    sessionId,
    handleCaptureComplete,
    handleCaptureError
  );

  // ---- Agora Event Handlers ----
  useEffect(() => {
    const handleUserPublished = async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
      }
    };

    const handleUserUnpublished = (user, mediaType) => {
      if (mediaType === 'video') {
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      }
    };

    const handleUserLeft = (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      // Call ended — cleanup
      endSession();
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left', handleUserLeft);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-left', handleUserLeft);
    };
  }, [client, endSession]);

  // Play remote video when user subscribes
  // Use a delayed retry to handle the race condition where the ref
  // isn't ready on the first render cycle.
  useEffect(() => {
    const playRemote = () => {
      if (remoteUsers.length > 0 && remoteVideoRef.current) {
        const user = remoteUsers[0];
        if (user.videoTrack) {
          user.videoTrack.play(remoteVideoRef.current);
        }
      }
    };
    playRemote();
    // Retry after a short delay in case the DOM isn't ready
    const timer = setTimeout(playRemote, 300);
    return () => clearTimeout(timer);
  }, [remoteUsers]);

  // Play local video
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.play(localVideoRef.current);
    }
  }, [localVideoTrack]);

  // ---- Join / Leave ----
  const joinChannel = useCallback(async () => {
    const appId = AR_CONFIG.AGORA_APP_ID;
    if (!appId) {
      alert('Please set VITE_AGORA_APP_ID in client/.env');
      return;
    }
    if (!inputChannel.trim()) {
      alert('Please enter a channel name');
      return;
    }

    setIsJoining(true);
    try {
      // Generate a numeric UID
      const uid = Math.floor(Math.random() * 100000);
      await client.join(appId, inputChannel, AR_CONFIG.AGORA_TEMP_TOKEN, uid);

      // Create and publish local camera track
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        facingMode: role === 'buyer' ? 'user' : 'environment',
      });
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await client.publish([videoTrack, audioTrack]);

      setLocalVideoTrack(videoTrack);
      setChannelName(inputChannel);
      setJoined(true);
      setSessionId(uuidv4());
    } catch (err) {
      console.error('[Agora] Join failed:', err);
      alert(`Failed to join: ${err.message}`);
    } finally {
      setIsJoining(false);
    }
  }, [client, inputChannel, role, setSessionId]);

  const leaveChannel = useCallback(async () => {
    localVideoTrack?.close();
    setLocalVideoTrack(null);
    await client.leave();
    setJoined(false);
    setRemoteUsers([]);
    endSession();
  }, [client, localVideoTrack, endSession]);

  // ---- Seller Actions ----
  const handlePresentGarment = useCallback(() => {
    transitionTo(SESSION_STATES.SELLER_PREPARING);
  }, [transitionTo]);

  const handleNewGarment = useCallback(() => {
    transitionTo(SESSION_STATES.SELLER_PREPARING);
  }, [transitionTo]);

  const handleRetry = useCallback(() => {
    transitionTo(SESSION_STATES.SELLER_PREPARING);
  }, [transitionTo]);

  // ---- Buyer consent ----
  const [consentGiven, setConsentGiven] = useState(false);

  // ---- Render ----
  if (!joined) {
    return (
      <div className="ar-session-panel" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="ar-card" style={{ maxWidth: 460, width: '100%' }}>
          <div className="ar-card__title">Join AR Session</div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--ar-text-muted)', marginBottom: 6 }}>
              Channel Name
            </label>
            <input
              type="text"
              value={inputChannel}
              onChange={(e) => setInputChannel(e.target.value)}
              placeholder="Enter channel name"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--ar-radius-sm)',
                border: '1px solid var(--ar-border)',
                background: 'var(--ar-surface)',
                color: 'var(--ar-text)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--ar-text-muted)', marginBottom: 6 }}>
              Your Role
            </label>
            <div style={{ fontSize: 14, color: 'var(--ar-text)', padding: '10px 14px', background: 'var(--ar-surface)', borderRadius: 'var(--ar-radius-sm)', border: '1px solid var(--ar-border)' }}>
              {role === 'seller' ? '🛍️ Seller (Salesperson)' : '👤 Buyer (Customer)'}
            </div>
          </div>

          <button
            className="ar-btn ar-btn--primary ar-btn--full"
            onClick={joinChannel}
            disabled={isJoining}
          >
            {isJoining ? 'Joining...' : '📹 Join Video Call'}
          </button>

          {!AR_CONFIG.AGORA_APP_ID && (
            <div className="session-banner session-banner--warning" style={{ marginTop: 12 }}>
              <span>⚠️</span>
              <span style={{ fontSize: 12 }}>Set VITE_AGORA_APP_ID in client/.env to enable video calls.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ar-session-panel">
      {/* Left side — Seller/local video + capture controls */}
      <div className="ar-session-panel__seller">
        <div className="ar-card" style={{ padding: 0 }}>
          <div className="ar-video-container">
            <div ref={localVideoRef} style={{ width: '100%', height: '100%' }} />
            <span className="ar-video-label">
              {role === 'seller' ? '📹 You (Seller)' : '📹 You (Buyer)'}
            </span>
          </div>
        </div>

        {role === 'seller' && (
          <SellerCapturePanel
            captureData={captureData}
            onPresentGarment={handlePresentGarment}
            onNewGarment={handleNewGarment}
          />
        )}

        <button className="ar-btn ar-btn--danger ar-btn--full" onClick={leaveChannel}>
          📴 Leave Call
        </button>
      </div>

      {/* Right side — Remote video + buyer status */}
      <div className="ar-session-panel__buyer">
        <div className="ar-card" style={{ padding: 0 }}>
          <div className="ar-video-container">
            {/* Always render the remote video container so the ref is stable */}
            <div
              ref={remoteVideoRef}
              style={{
                width: '100%',
                height: '100%',
                display: remoteUsers.length > 0 ? 'block' : 'none',
              }}
            />
            {remoteUsers.length === 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: 'var(--ar-text-muted)', fontSize: 14,
              }}>
                Waiting for {role === 'seller' ? 'buyer' : 'seller'} to join...
              </div>
            )}
            <span className="ar-video-label">
              {role === 'seller' ? '👤 Buyer (Remote)' : '🛍️ Seller (Remote)'}
            </span>
          </div>
        </div>

        {/* Buyer-side: session status + consent */}
        {role === 'buyer' && (
          <>
            <SessionStatusBanner
              state={sessionState}
              error={error}
              onRetry={handleRetry}
            />

            {sessionState === SESSION_STATES.AR_ACTIVE && !consentGiven && (
              <ConsentModal
                onAccept={() => setConsentGiven(true)}
                onDecline={() => setConsentGiven(false)}
              />
            )}

            {sessionState === SESSION_STATES.AR_ACTIVE && consentGiven && (
              <BuyerARPanel />
            )}
          </>
        )}

        {/* Session info */}
        <div style={{ fontSize: 11, color: 'var(--ar-text-muted)', padding: '0 4px' }}>
          Session: {sessionId?.slice(0, 8)}... | State: {sessionState} | Channel: {channelName}
        </div>
      </div>
    </div>
  );
}

/**
 * ARSessionPanel — wrapped with SessionProvider.
 */
export default function ARSessionPanel({ role = 'seller' }) {
  return (
    <SessionProvider>
      <ARSessionPanelInner role={role} />
    </SessionProvider>
  );
}
