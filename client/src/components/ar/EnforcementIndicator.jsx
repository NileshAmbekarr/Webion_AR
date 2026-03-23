import { useMemo } from 'react';
import './ar.css';

/**
 * EnforcementIndicator — displays a single enforcement rule status.
 *
 * @param {string} label — Rule name (e.g. "Mannequin Visible")
 * @param {string} detail — Current value / status detail
 * @param {'passed' | 'failed' | 'pending'} status
 */
export default function EnforcementIndicator({ label, detail, status = 'failed' }) {
  const icon = useMemo(() => {
    switch (status) {
      case 'passed': return '✓';
      case 'pending': return '⟳';
      case 'failed': default: return '✗';
    }
  }, [status]);

  return (
    <div className={`enforcement-item enforcement-item--${status}`}>
      <div className={`enforcement-icon enforcement-icon--${status}`}>
        {icon}
      </div>
      <span className="enforcement-label">{label}</span>
      {detail && <span className="enforcement-detail">{detail}</span>}
    </div>
  );
}
