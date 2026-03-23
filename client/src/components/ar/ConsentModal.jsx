import { useState, useEffect, useCallback } from 'react';
import './ar.css';

const CONSENT_KEY = 'webion_ar_consent_v1';

/**
 * ConsentModal — DPDP-compliant camera consent dialog.
 * Shows before buyer's camera activates.
 * Stores decision in localStorage.
 *
 * @param {Function} onAccept — called when user grants consent
 * @param {Function} onDecline — called when user declines
 */
export default function ConsentModal({ onAccept, onDecline }) {
  const [isOpen, setIsOpen] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(CONSENT_KEY);
    if (saved === 'accepted') {
      onAccept?.();
    } else if (saved === 'declined') {
      setDeclined(true);
    } else {
      setIsOpen(true);
    }
  }, [onAccept]);

  const handleAccept = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setIsOpen(false);
    onAccept?.();
  }, [onAccept]);

  const handleDecline = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setIsOpen(false);
    setDeclined(true);
    onDecline?.();
  }, [onDecline]);

  if (declined) {
    return (
      <div className="session-banner session-banner--warning" style={{ margin: '16px 0' }}>
        <span>📷</span>
        <span>Camera access is required for AR Try-On. Reload the page to change your preference.</span>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="consent-overlay">
      <div className="consent-modal">
        <div className="consent-modal__icon">🔒</div>
        <h2 className="consent-modal__title">Camera Access Required</h2>
        <p className="consent-modal__text">
          To try on garments virtually, we need access to your front camera.
          <br /><br />
          <span className="consent-modal__highlight">
            Your camera is used only on your device. No video is sent to our servers.
          </span>
          <br /><br />
          The camera feed is processed entirely in your browser for body detection.
          We do not store, transmit, or record any of your video.
        </p>
        <div className="consent-modal__actions">
          <button className="ar-btn ar-btn--primary" onClick={handleAccept} style={{ flex: 1 }}>
            Accept & Continue
          </button>
          <button className="ar-btn ar-btn--secondary" onClick={handleDecline} style={{ flex: 1 }}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if consent was previously granted (utility for other components).
 */
export function hasARConsent() {
  return localStorage.getItem(CONSENT_KEY) === 'accepted';
}
