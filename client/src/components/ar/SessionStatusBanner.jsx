import './ar.css';

/**
 * SessionStatusBanner — displays the current session state to the buyer.
 *
 * @param {string} state — current session state from SESSION_STATES
 * @param {string} error — error message if state is ERROR
 * @param {Function} onRetry — callback for retry button
 */
export default function SessionStatusBanner({ state, error, onRetry }) {
  const config = getConfigForState(state, error);
  if (!config) return null;

  return (
    <div className={`session-banner session-banner--${config.variant}`}>
      {config.showSpinner && <div className="session-banner__spinner" />}
      {config.icon && <span>{config.icon}</span>}
      <span>{config.message}</span>
      {config.showRetry && onRetry && (
        <button className="ar-btn ar-btn--secondary" onClick={onRetry} style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '12px' }}>
          Try Again
        </button>
      )}
    </div>
  );
}

function getConfigForState(state, error) {
  switch (state) {
    case 'IDLE':
      return null; // No banner when idle
    case 'SELLER_PREPARING':
      return {
        variant: 'info',
        icon: '🎯',
        message: 'Salesperson is positioning the garment...',
        showSpinner: false,
      };
    case 'SCANNING':
      return {
        variant: 'info',
        message: 'Scanning for garment on mannequin...',
        showSpinner: true,
      };
    case 'COUNTING_DOWN':
      return {
        variant: 'info',
        message: 'Garment detected! Holding steady...',
        showSpinner: true,
      };
    case 'PROCESSING':
      return {
        variant: 'warning',
        message: 'Processing garment image... This takes a few seconds.',
        showSpinner: true,
      };
    case 'AR_ACTIVE':
      return {
        variant: 'success',
        icon: '✨',
        message: 'Garment ready! Press "Try On" to see it on your body.',
        showSpinner: false,
      };
    case 'ERROR':
      return {
        variant: 'error',
        icon: '⚠️',
        message: error || 'Something went wrong. Please try again.',
        showSpinner: false,
        showRetry: true,
      };
    default:
      return null;
  }
}
