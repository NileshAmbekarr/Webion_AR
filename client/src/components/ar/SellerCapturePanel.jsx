import { useMemo } from 'react';
import { useSessionState, SESSION_STATES } from '../../context/SessionContext';
import EnforcementIndicator from './EnforcementIndicator';
import './ar.css';

/**
 * SellerCapturePanel — seller's enforcement UI + capture controls.
 * Shows real-time enforcement indicators, countdown, and capture status.
 *
 * @param {Object} captureData — from useFrameCapture hook
 * @param {Function} onPresentGarment — called when seller clicks "Present Garment"
 * @param {Function} onNewGarment — called when seller clicks "Show New Garment"
 */
export default function SellerCapturePanel({ captureData, onPresentGarment, onNewGarment }) {
  const { sessionState, transitionTo } = useSessionState();
  const { captureStatus, countdown, qualityWarnings, enforcementDetails } = captureData || {};

  const isIdle = sessionState === SESSION_STATES.IDLE;
  const isActive = [
    SESSION_STATES.SELLER_PREPARING,
    SESSION_STATES.SCANNING,
    SESSION_STATES.COUNTING_DOWN,
  ].includes(sessionState);
  const isProcessing = sessionState === SESSION_STATES.PROCESSING;
  const isARActive = sessionState === SESSION_STATES.AR_ACTIVE;

  // Derive enforcement statuses
  const mannequinStatus = enforcementDetails?.mannequin ? 'passed' : (isActive ? 'failed' : 'failed');
  const lightingStatus = enforcementDetails?.lighting ? 'passed' : (isActive ? 'failed' : 'failed');
  const stabilityStatus = useMemo(() => {
    if (captureStatus === 'counting_down') return 'pending';
    return enforcementDetails?.stability ? 'passed' : 'failed';
  }, [captureStatus, enforcementDetails?.stability]);

  // Countdown bar
  const countdownPercent = useMemo(() => {
    if (captureStatus !== 'counting_down') return 0;
    return ((3 - countdown) / 3) * 100;
  }, [captureStatus, countdown]);

  const lightingDetail = useMemo(() => {
    if (!enforcementDetails) return '';
    const lum = Math.round(enforcementDetails.luminance);
    if (lum < 80) return `Too dark (${lum})`;
    if (lum > 220) return `Too bright (${lum})`;
    return `Good (${lum})`;
  }, [enforcementDetails?.luminance]);

  const stabilityDetail = useMemo(() => {
    if (!enforcementDetails) return '';
    if (captureStatus === 'counting_down') return `${countdown}s remaining`;
    const delta = Math.round(enforcementDetails.frameDelta * 10) / 10;
    return delta < 255 ? `Δ ${delta}` : 'Measuring...';
  }, [enforcementDetails?.frameDelta, captureStatus, countdown]);

  return (
    <div className="ar-card">
      <div className="ar-card__title">Garment Capture</div>

      {/* Idle state — show "Present Garment" button */}
      {isIdle && (
        <button
          className="ar-btn ar-btn--primary ar-btn--full"
          onClick={onPresentGarment}
        >
          🎯 Present Garment
        </button>
      )}

      {/* Active capture state — show enforcement indicators */}
      {isActive && (
        <>
          <div className="enforcement-list">
            <EnforcementIndicator
              label="Mannequin"
              detail={enforcementDetails?.mannequin ? 'Detected' : 'Not visible'}
              status={mannequinStatus}
            />
            <EnforcementIndicator
              label="Lighting"
              detail={lightingDetail}
              status={lightingStatus}
            />
            <EnforcementIndicator
              label="Stability"
              detail={stabilityDetail}
              status={stabilityStatus}
            />
          </div>

          {/* Countdown bar */}
          {captureStatus === 'counting_down' && (
            <div className="countdown-bar" style={{ marginTop: 16 }}>
              <div
                className="countdown-bar__fill"
                style={{ width: `${countdownPercent}%` }}
              />
              <span className="countdown-bar__text">
                HOLD STEADY — Capturing in {countdown}s
              </span>
            </div>
          )}

          {/* Rules reminder */}
          <div className="ar-rules">
            <div className="ar-rules__title">Capture Rules</div>
            <ul className="ar-rules__list">
              <li>Full mannequin must be visible</li>
              <li>Hold still for 3 seconds</li>
              <li>Ensure good lighting</li>
            </ul>
          </div>
        </>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div className="session-banner session-banner--warning">
          <div className="session-banner__spinner" />
          <span>Processing garment... Please wait.</span>
        </div>
      )}

      {/* Capture sent status */}
      {captureStatus === 'sent' && isProcessing && (
        <div style={{ textAlign: 'center', color: 'var(--ar-text-muted)', marginTop: 8, fontSize: 12 }}>
          Frame captured and sent to backend for segmentation.
        </div>
      )}

      {/* AR Active — show "New Garment" button */}
      {isARActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="session-banner session-banner--success">
            <span>✨</span>
            <span>Garment is live on buyer's screen!</span>
          </div>
          <button
            className="ar-btn ar-btn--secondary ar-btn--full"
            onClick={onNewGarment}
          >
            🔄 Show New Garment
          </button>
        </div>
      )}
    </div>
  );
}
