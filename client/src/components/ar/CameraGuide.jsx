import { useEffect, useState } from 'react';
import './buyer-ar.css';

/**
 * CameraGuide — Track B
 * Instruction overlay shown when buyer's camera first activates.
 * Auto-dismisses after 3 seconds or on user tap/click.
 *
 * Props:
 *   onDismiss — callback fired when guide hides
 */
export default function CameraGuide({ onDismiss }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onDismiss) onDismiss();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  function handleDismiss() {
    setVisible(false);
    if (onDismiss) onDismiss();
  }

  if (!visible) return null;

  return (
    <div className="camera-guide-overlay" onClick={handleDismiss} role="dialog" aria-label="Camera positioning guide">
      {/* Stylised body silhouette outline */}
      <div className="camera-guide-body-outline" aria-hidden="true" />

      <div className="camera-guide-texts">
        <p>Stand about <strong>1.5 m</strong> from your camera</p>
        <p>Keep your <strong>full body</strong> visible</p>
        <p className="camera-guide-tap-hint">Tap anywhere or wait to continue…</p>
      </div>

      <button
        className="camera-guide-dismiss-btn"
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
      >
        Got it
      </button>
    </div>
  );
}
