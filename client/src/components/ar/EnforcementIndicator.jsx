// Placeholder — Track C (Agent 1) implements this component
export default function EnforcementIndicator({ label, passed }) {
  return (
    <div style={{ color: passed ? 'green' : 'red' }}>
      {passed ? '✓' : '✗'} {label}
    </div>
  );
}
