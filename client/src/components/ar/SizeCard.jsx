import { useMemo } from 'react';
import { getFitRecommendation } from '../../utils/sizeRecommendation';
import './buyer-ar.css';

/**
 * SizeCard — Track B
 * Displays garment dimensions and a fit recommendation badge.
 *
 * Props:
 *   garmentShoulderCm  — number | null
 *   garmentChestCm     — number | null
 *   garmentLengthCm    — number | null
 *   buyerShoulderPx    — number  (shoulder width in px from keypoints)
 *   videoWidthPx       — number  (canvas width)
 */
export default function SizeCard({
  garmentShoulderCm = null,
  garmentChestCm = null,
  garmentLengthCm = null,
  buyerShoulderPx = 0,
  videoWidthPx = 0,
}) {
  const fit = useMemo(() => {
    if (garmentShoulderCm == null) return null;
    return getFitRecommendation(garmentShoulderCm);
  }, [garmentShoulderCm]);

  function fmt(val) {
    return val != null ? `${val} cm` : null;
  }

  return (
    <div className="size-card" role="region" aria-label="Size estimate">
      <h3>📐 Size Estimate</h3>

      <div className="size-card-measurements">
        <Metric label="Shoulder" value={fmt(garmentShoulderCm)} />
        <Metric label="Chest" value={fmt(garmentChestCm)} />
        <Metric label="Length" value={fmt(garmentLengthCm)} />
      </div>

      {fit ? (
        <div className="size-card-fit">
          <div>
            <span
              className="fit-badge"
              style={{ backgroundColor: fit.color + '22', color: fit.color, border: `1px solid ${fit.color}66` }}
            >
              {fit.badge} FIT
            </span>
          </div>
          <p className="fit-message">{fit.message}</p>
        </div>
      ) : (
        <div className="size-card-fit">
          <p className="fit-message" style={{ color: '#4a5568' }}>
            Awaiting garment data…
          </p>
        </div>
      )}

      <p className="size-card-disclaimer">
        <span>⚠</span>
        Measurements are estimates. Confirm with salesperson.
      </p>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="size-card-metric">
      <span className="label">{label}</span>
      <span className={`value ${value == null ? 'na' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}
